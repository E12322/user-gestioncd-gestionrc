import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { normalize } from "@/shared/lib/format";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db } from "../mocks";
import { overlaps, toMinutes, todayISO } from "../utils/time";
import { CLOSE_HOUR, OPEN_HOUR, OPEN_HOURS } from "../types";
import type { Availability, Reservation, ReservationInput, ReservationStatus, Room, RoomFilters, RoomView } from "../types";

/**
 * Stubs du resource-service (via l'API Gateway). En production l'identité vient du JWT ;
 * en mock elle est passée explicitement (`Viewer`).
 * Erreurs : 403 interdit · 404 introuvable · 409 créneau déjà pris · 422 saisie invalide.
 */
export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "resource-service";
const svc = (viewer: Viewer) => {
  assertAvailable("resources");
  if (viewer.role === "student") throw new ApiError(403, "Accès interdit aux étudiants");
};
const clone = <T>(x: T): T => structuredClone(x);

function roomById(id: string): Room {
  const r = db.rooms.find((x) => x.id === id);
  if (!r) throw new ApiError(404, "Salle introuvable");
  return r;
}

const fmt = (r: { start: string; end: string }) => `${r.start}–${r.end}`;

/** Réservations confirmées qui chevauchent le créneau demandé (seules elles bloquent la salle). */
function confirmedConflicts(roomId: string, date: string, slot: { start: string; end: string }, ignoreId?: string) {
  return db.reservations.filter(
    (r) => r.id !== ignoreId && r.roomId === roomId && r.date === date && r.status === "confirmed" && overlaps(r, slot),
  );
}

const conflictError = (roomName: string, date: string, clashes: Reservation[]) =>
  new ApiError(409, `${roomName} est déjà réservée sur ce créneau`, {
    code: "ROOM_CONFLICT",
    conflicts: clashes.map((c) => `${roomName} — ${fmt(c)} le ${date} (réservation confirmée)`),
  });

function busyHours(roomId: string, date: string) {
  const minutes = db.reservations
    .filter((r) => r.roomId === roomId && r.date === date && r.status !== "refused")
    .reduce((n, r) => n + (toMinutes(r.end) - toMinutes(r.start)), 0);
  return Math.min(OPEN_HOURS, Math.round((minutes / 60) * 10) / 10);
}

// ---------- Salles ----------

/** GET /rooms?q=&building=&minCapacity= */
export const listRooms = (filters: RoomFilters, viewer: Viewer, signal?: AbortSignal) =>
  api.get<RoomView[]>("/rooms", {
    signal,
    mock: () => {
      svc(viewer);
      const q = normalize(filters.q?.trim() ?? "");
      const today = todayISO();
      return clone(
        db.rooms
          .filter(
            (r) =>
              (!filters.building || r.building === filters.building) &&
              (!filters.minCapacity || r.capacity >= filters.minCapacity) &&
              (!q || normalize(`${r.name} ${r.building} ${r.equipment.map((e) => e.label).join(" ")}`).includes(q)),
          )
          .map((r) => ({ ...r, bookedHoursToday: busyHours(r.id, today), openHours: OPEN_HOURS })),
      );
    },
  });

/** GET /rooms/{id}/availability?date= — créneaux occupés (confirmés ou en attente). */
export const getAvailability = (roomId: string, date: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<Availability>(`/rooms/${roomId}/availability`, {
    signal,
    mock: () => {
      svc(viewer);
      roomById(roomId);
      const slots = db.reservations
        .filter((r) => r.roomId === roomId && r.date === date && r.status !== "refused")
        .map((r) => ({ start: r.start, end: r.end, status: r.status as "pending" | "confirmed" }))
        .sort((a, b) => a.start.localeCompare(b.start));
      return clone({ roomId, date, slots });
    },
  });

// ---------- Réservations ----------

/** GET /reservations?scope= — « mine » : les miennes · « all » : toutes (administrateur). */
export const listReservations = (scope: "mine" | "all", viewer: Viewer, signal?: AbortSignal) =>
  api.get<Reservation[]>(`/reservations?scope=${scope}`, {
    signal,
    mock: () => {
      svc(viewer);
      if (scope === "all" && viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
      return clone(
        db.reservations
          .filter((r) => scope === "all" || r.requesterId === viewer.id)
          .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
      );
    },
  });

/**
 * POST /reservations — 409 si le créneau chevauche une réservation confirmée.
 * Enseignant : demande « en attente » (RéservationCréée) · administrateur : confirmée d'emblée (RéservationConfirmée).
 */
export const createReservation = (input: ReservationInput, viewer: Viewer) =>
  api.post<Reservation>("/reservations", {
    body: input,
    mock: () => {
      svc(viewer);
      const room = roomById(input.roomId);
      if (input.date < todayISO()) throw new ApiError(422, "La date ne peut pas être dans le passé");
      if (
        toMinutes(input.start) < OPEN_HOUR * 60 ||
        toMinutes(input.end) > CLOSE_HOUR * 60 ||
        toMinutes(input.end) <= toMinutes(input.start)
      ) {
        throw new ApiError(422, `Le créneau doit tenir entre ${OPEN_HOUR}:00 et ${CLOSE_HOUR}:00`);
      }
      if (input.attendees > room.capacity)
        throw new ApiError(422, `${room.name} accueille au maximum ${room.capacity} personnes`, { code: "OVER_CAPACITY" });
      const clashes = confirmedConflicts(room.id, input.date, input);
      if (clashes.length) throw conflictError(room.name, input.date, clashes);

      const admin = viewer.role === "admin";
      const created: Reservation = {
        id: `rs-${++db.seq}`,
        roomId: room.id,
        roomName: room.name,
        building: room.building,
        requesterId: viewer.id,
        requesterName: viewer.name,
        date: input.date,
        start: input.start,
        end: input.end,
        attendees: input.attendees,
        purpose: input.purpose.trim(),
        status: admin ? "confirmed" : "pending",
        requestedAt: db.now(),
        decidedAt: admin ? db.now() : undefined,
      };
      db.reservations.unshift(created);
      publishDomainEvent(SERVICE, admin ? "RéservationConfirmée" : "RéservationCréée", `${room.name} · ${input.date} ${fmt(input)}`);
      return clone(created);
    },
  });

/** PUT /reservations/{id}/status (administrateur) — confirmer re-vérifie les conflits (409) et publie RéservationConfirmée. */
export const decideReservation = (id: string, status: Exclude<ReservationStatus, "pending">, viewer: Viewer) =>
  api.put<Reservation>(`/reservations/${id}/status`, {
    body: { status },
    mock: () => {
      svc(viewer);
      if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
      const r = db.reservations.find((x) => x.id === id);
      if (!r) throw new ApiError(404, "Réservation introuvable");
      if (r.status !== "pending") throw new ApiError(409, "Cette demande a déjà été traitée", { code: "ALREADY_DECIDED", conflicts: [] });
      if (status === "confirmed") {
        const clashes = confirmedConflicts(r.roomId, r.date, r, r.id);
        if (clashes.length) throw conflictError(r.roomName, r.date, clashes);
      }
      r.status = status;
      r.decidedAt = db.now();
      if (status === "confirmed")
        publishDomainEvent(SERVICE, "RéservationConfirmée", `${r.requesterName} · ${r.roomName} · ${r.date} ${fmt(r)}`);
      return clone(r);
    },
  });
