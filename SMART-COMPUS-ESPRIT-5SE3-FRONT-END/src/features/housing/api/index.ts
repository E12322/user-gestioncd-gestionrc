import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db } from "../mocks";
import { todayISO } from "../utils/time";
import type {
  HousingRequest,
  HousingRequestInput,
  HousingRoom,
  Residence,
  RequestStatus,
  RoomType,
  Ticket,
  TicketInput,
  TicketStatus,
} from "../types";

/**
 * Stubs du housing-service (via l'API Gateway). En production l'identité vient du JWT ;
 * en mock elle est passée explicitement (`Viewer`).
 * Erreurs : 403 interdit · 404 introuvable · 409 résidence pleine / doublon · 422 saisie invalide.
 */
export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "housing-service";
const svc = (viewer: Viewer) => {
  assertAvailable("housing");
  if (viewer.role === "teacher") throw new ApiError(403, "Accès interdit aux enseignants");
};
const adminOnly = (viewer: Viewer) => {
  svc(viewer);
  if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
};
const clone = <T>(x: T): T => structuredClone(x);

const withOccupancy = (base: Omit<Residence, "capacity" | "occupied">): Residence => {
  const rooms = db.rooms.filter((r) => r.residenceId === base.id);
  return { ...base, capacity: rooms.reduce((n, r) => n + r.beds, 0), occupied: rooms.reduce((n, r) => n + r.occupants, 0) };
};

function residenceById(id: string): Residence {
  const base = db.residences.find((r) => r.id === id);
  if (!base) throw new ApiError(404, "Résidence introuvable");
  return withOccupancy(base);
}

const fullError = (r: Residence) =>
  new ApiError(409, `${r.name} est complète`, {
    code: "RESIDENCE_FULL",
    conflicts: [`${r.name} — ${r.occupied}/${r.capacity} lits occupés`],
  });

// ---------- Résidences et chambres ----------

/** GET /residences */
export const listResidences = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<Residence[]>("/residences", {
    signal,
    mock: () => {
      svc(viewer);
      return clone(db.residences.map(withOccupancy));
    },
  });

/** GET /residences/{id}/rooms?type= — chambres avec au moins un lit libre (administrateur). */
export const listAvailableRooms = (residenceId: string, type: RoomType | undefined, viewer: Viewer, signal?: AbortSignal) =>
  api.get<HousingRoom[]>(`/residences/${residenceId}/rooms`, {
    signal,
    mock: () => {
      adminOnly(viewer);
      residenceById(residenceId);
      return clone(db.rooms.filter((r) => r.residenceId === residenceId && r.occupants < r.beds && (!type || r.type === type)));
    },
  });

// ---------- Demandes d'hébergement ----------

/** GET /housing-requests/me — dernière demande de l'étudiant (ou null). */
export const getMyRequest = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<HousingRequest | null>("/housing-requests/me", {
    signal,
    mock: () => {
      svc(viewer);
      if (viewer.role !== "student") throw new ApiError(403, "Réservé aux étudiants");
      const mine = db.requests.filter((r) => r.studentId === viewer.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
      return clone(mine[0] ?? null);
    },
  });

/** POST /housing-requests — 409 si résidence pleine ou demande déjà active. Publie DemandeDéposée. */
export const createRequest = (input: HousingRequestInput, viewer: Viewer) =>
  api.post<HousingRequest>("/housing-requests", {
    body: input,
    mock: () => {
      svc(viewer);
      if (viewer.role !== "student") throw new ApiError(403, "Réservé aux étudiants");
      const residence = residenceById(input.residenceId);
      if (input.entryDate < todayISO()) throw new ApiError(422, "La date d'entrée ne peut pas être dans le passé");
      if (db.requests.some((r) => r.studentId === viewer.id && r.status !== "refused")) {
        throw new ApiError(409, "Vous avez déjà une demande en cours ou une chambre affectée", {
          code: "ALREADY_REQUESTED",
          conflicts: [],
        });
      }
      if (residence.occupied >= residence.capacity) throw fullError(residence);

      const created: HousingRequest = {
        id: `q-${++db.seq}`,
        studentId: viewer.id,
        studentName: viewer.name,
        residenceId: residence.id,
        residenceName: residence.name,
        roomType: input.roomType,
        entryDate: input.entryDate,
        durationMonths: input.durationMonths,
        accessibility: input.accessibility,
        notes: input.notes.trim(),
        status: "pending",
        requestedAt: db.now(),
      };
      db.requests.unshift(created);
      publishDomainEvent(SERVICE, "DemandeDéposée", `${viewer.name} · ${residence.name}`);
      return clone(created);
    },
  });

/** DELETE /housing-requests/{id} — l'étudiant retire sa demande tant qu'elle est en attente. */
export const cancelRequest = (id: string, viewer: Viewer) =>
  api.delete<void>(`/housing-requests/${id}`, {
    mock: () => {
      svc(viewer);
      const r = db.requests.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "Demande introuvable");
      if (r.studentId !== viewer.id) throw new ApiError(403, "Cette demande n'est pas la vôtre");
      if (r.status !== "pending") throw new ApiError(409, "Cette demande a déjà été traitée", { code: "ALREADY_DECIDED", conflicts: [] });
      db.requests.splice(db.requests.indexOf(r), 1);
    },
  });

/** GET /housing-requests (administrateur) */
export const listRequests = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<HousingRequest[]>("/housing-requests", {
    signal,
    mock: () => {
      adminOnly(viewer);
      return clone([...db.requests].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
    },
  });

function pendingRequest(id: string) {
  const r = db.requests.find((x) => x.id === id);
  if (!r) throw new ApiError(404, "Demande introuvable");
  if (r.status !== "pending") throw new ApiError(409, "Cette demande a déjà été traitée", { code: "ALREADY_DECIDED", conflicts: [] });
  return r;
}

/** PUT /housing-requests/{id}/assign — 409 si la résidence ou la chambre est pleine. Publie ChambreAffectée. */
export const assignRoom = (id: string, roomId: string, viewer: Viewer) =>
  api.put<HousingRequest>(`/housing-requests/${id}/assign`, {
    body: { roomId },
    mock: () => {
      adminOnly(viewer);
      const r = pendingRequest(id);
      const room = db.rooms.find((x) => x.id === roomId);
      if (!room) throw new ApiError(404, "Chambre introuvable");
      const residence = residenceById(room.residenceId);
      if (residence.occupied >= residence.capacity) throw fullError(residence);
      if (room.occupants >= room.beds) {
        throw new ApiError(409, `La chambre ${room.number} est déjà complète`, {
          code: "ROOM_FULL",
          conflicts: [`${residence.name} — chambre ${room.number} : ${room.occupants}/${room.beds} lits occupés`],
        });
      }
      room.occupants += 1;
      r.status = "confirmed";
      r.decidedAt = db.now();
      r.assignedResidenceName = residence.name;
      r.assignedRoomNumber = room.number;
      publishDomainEvent(SERVICE, "ChambreAffectée", `${r.studentName} · ${residence.name} · chambre ${room.number}`);
      return clone(r);
    },
  });

/** PUT /housing-requests/{id}/refuse */
export const refuseRequest = (id: string, viewer: Viewer) =>
  api.put<HousingRequest>(`/housing-requests/${id}/refuse`, {
    mock: () => {
      adminOnly(viewer);
      const r = pendingRequest(id);
      r.status = "refused" satisfies RequestStatus;
      r.decidedAt = db.now();
      return clone(r);
    },
  });

// ---------- Maintenance ----------

/** GET /tickets — l'étudiant voit les siens, l'administrateur tous. */
export const listTickets = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<Ticket[]>("/tickets", {
    signal,
    mock: () => {
      svc(viewer);
      return clone(
        db.tickets
          .filter((t) => viewer.role === "admin" || t.studentId === viewer.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
  });

/** POST /tickets — signalement d'une panne. */
export const createTicket = (input: TicketInput, viewer: Viewer) =>
  api.post<Ticket>("/tickets", {
    body: input,
    mock: () => {
      svc(viewer);
      const residence = residenceById(input.residenceId);
      const now = db.now();
      const created: Ticket = {
        id: `t-${++db.seq}`,
        studentId: viewer.id,
        studentName: viewer.name,
        residenceId: residence.id,
        residenceName: residence.name,
        location: input.location.trim(),
        category: input.category,
        description: input.description.trim(),
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      db.tickets.unshift(created);
      return clone(created);
    },
  });

/** PUT /tickets/{id}/status (administrateur) — Signalé → En cours → Résolu. */
export const updateTicketStatus = (id: string, status: TicketStatus, viewer: Viewer) =>
  api.put<Ticket>(`/tickets/${id}/status`, {
    body: { status },
    mock: () => {
      adminOnly(viewer);
      const t = db.tickets.find((x) => x.id === id);
      if (!t) throw new ApiError(404, "Signalement introuvable");
      t.status = status;
      t.updatedAt = db.now();
      return clone(t);
    },
  });
