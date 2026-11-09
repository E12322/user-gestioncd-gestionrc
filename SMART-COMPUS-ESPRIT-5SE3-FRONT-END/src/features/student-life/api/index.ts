import { api, onRequest } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { normalize } from "@/shared/lib/format";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db } from "../mocks";
import { todayISO, toMinutes } from "../utils/time";
import type {
  CampusEvent,
  Club,
  ClubDetail,
  ClubFilters,
  ClubInput,
  ClubReport,
  ClubView,
  EventFilters,
  EventInput,
  EventRegistration,
  MemberDetail,
  Membership,
  MembershipStatus,
} from "../types";

/**
 * URL de base du microservice vie-etudiante / club-service (port 4005 par défaut).
 */
const STUDENT_LIFE_API_BASE_URL = import.meta.env.VITE_STUDENT_LIFE_API_BASE_URL ?? "http://localhost:4005";

// Intercepteur pour router les requêtes du module student-life vers son microservice (port 4005)
onRequest((config) => {
  const routes = ["/clubs", "/memberships", "/events"];
  for (const route of routes) {
    if (config.url.includes(route)) {
      const idx = config.url.indexOf(route);
      const endpoint = config.url.substring(idx);
      config.url = `${STUDENT_LIFE_API_BASE_URL}${endpoint}`;
      break;
    }
  }
  return config;
});

const toQuery = (params: Record<string, string | undefined>): string => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) q.set(k, v.trim());
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

/**
 * En production ou mode réel, l'identité et le rôle sont lus directement depuis le JWT
 * (cookie sc_access ou Bearer). En mode mock, ils sont passés explicitement (Viewer).
 */
export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "club-service";
const svc = () => assertAvailable("student-life");
const adminOnly = (viewer: Viewer) => {
  svc();
  if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
};
const clone = <T>(x: T): T => structuredClone(x);

function clubById(id: string): Club {
  const c = db.clubs.find((x) => x.id === id);
  if (!c) throw new ApiError(404, "Club introuvable");
  return c;
}

const mineIn = (clubId: string, viewerId: string) => db.memberships.find((m) => m.clubId === clubId && m.memberId === viewerId);
const withState = (c: Club, viewerId: string): ClubView => {
  const m = mineIn(c.id, viewerId);
  return { ...c, myMembership: m ? { id: m.id, status: m.status } : undefined };
};
const fullError = (c: Club) =>
  new ApiError(409, `${c.name} est complet`, { code: "CLUB_FULL", conflicts: [`${c.name} — ${c.members}/${c.maxMembers} membres`] });

// ---------- Clubs ----------

/** GET /clubs?q=&category= */
export const listClubs = (filters: ClubFilters, viewer: Viewer, signal?: AbortSignal) => {
  const qs = toQuery({ q: filters.q, category: filters.category });
  return api.get<ClubView[]>(`/clubs${qs}`, {
    signal,
    mock: () => {
      svc();
      const q = normalize(filters.q?.trim() ?? "");
      return clone(
        db.clubs
          .filter(
            (c) =>
              (!filters.category || c.category === filters.category) &&
              (!q || normalize(`${c.name} ${c.category} ${c.description}`).includes(q)),
          )
          .map((c) => withState(c, viewer.id)),
      );
    },
  });
};

/** GET /clubs/{id} — fiche, membres confirmés connus et événements à venir. */
export const getClub = (id: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<ClubDetail>(`/clubs/${id}`, {
    signal,
    mock: () => {
      svc();
      const c = clubById(id);
      const today = todayISO();
      return clone({
        ...withState(c, viewer.id),
        memberNames: db.memberships.filter((m) => m.clubId === id && m.status === "confirmed").map((m) => m.memberName),
        events: db.events
          .filter((e) => e.clubId === id && e.date >= today)
          .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
      });
    },
  });

/** POST /clubs (administrateur) — publie ClubCréé. 409 si le nom existe déjà. */
export const createClub = async (input: ClubInput, viewer: Viewer) => {
  const res = await api.post<Club>("/clubs", {
    body: input,
    mock: () => {
      adminOnly(viewer);
      const name = input.name.trim();
      if (db.clubs.some((c) => normalize(c.name) === normalize(name))) {
        throw new ApiError(409, "Un club porte déjà ce nom", { code: "CLUB_EXISTS", conflicts: [name] });
      }
      const created: Club = {
        id: `k${++db.seq}`,
        name,
        category: input.category,
        description: input.description.trim(),
        meetingPlace: input.meetingPlace.trim(),
        members: 0,
        maxMembers: input.maxMembers,
      };
      db.clubs.unshift(created);
      publishDomainEvent(SERVICE, "ClubCréé", `${created.name} · ${created.category}`);
      return clone(created);
    },
  });
  publishDomainEvent(SERVICE, "ClubCréé", `${res.name} · ${res.category}`);
  return res;
};

// ---------- Adhésions ----------

/** POST /clubs/{id}/members — demande d'adhésion (en attente de validation). 409 si doublon ou club complet. */
export const requestMembership = (clubId: string, viewer: Viewer) =>
  api.post<Membership>(`/clubs/${clubId}/members`, {
    mock: () => {
      svc();
      if (viewer.role === "admin") throw new ApiError(403, "Les administrateurs gèrent les clubs, ils n'y adhèrent pas");
      const club = clubById(clubId);
      const existing = mineIn(clubId, viewer.id);
      if (existing && existing.status !== "refused") {
        throw new ApiError(
          409,
          existing.status === "confirmed" ? "Vous êtes déjà membre de ce club" : "Vous avez déjà une demande en attente",
          { code: "ALREADY_MEMBER", conflicts: [] },
        );
      }
      if (club.members >= club.maxMembers) throw fullError(club);
      if (existing) db.memberships.splice(db.memberships.indexOf(existing), 1); // nouvelle demande après un refus
      const created: Membership = {
        id: `m-${++db.seq}`,
        clubId,
        clubName: club.name,
        memberId: viewer.id,
        memberName: viewer.name,
        memberRole: viewer.role,
        status: "pending",
        requestedAt: db.now(),
      };
      db.memberships.unshift(created);
      return clone(created);
    },
  });

/** DELETE /clubs/{id}/members/me — retire la demande en attente ou quitte le club. */
export const leaveClub = (clubId: string, viewer: Viewer) =>
  api.delete<void>(`/clubs/${clubId}/members/me`, {
    mock: () => {
      svc();
      const club = clubById(clubId);
      const m = mineIn(clubId, viewer.id);
      if (!m || m.status === "refused") throw new ApiError(404, "Aucune adhésion à retirer");
      if (m.status === "confirmed") club.members = Math.max(0, club.members - 1);
      db.memberships.splice(db.memberships.indexOf(m), 1);
    },
  });

/** GET /memberships (administrateur) */
export const listMemberships = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<Membership[]>("/memberships", {
    signal,
    mock: () => {
      adminOnly(viewer);
      return clone([...db.memberships].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)));
    },
  });

/** PUT /memberships/{id}/status (administrateur) — confirmer publie AdhésionConfirmée ; 409 si le club est complet. */
export const decideMembership = async (id: string, status: Exclude<MembershipStatus, "pending">, viewer: Viewer) => {
  const res = await api.put<Membership>(`/memberships/${id}/status`, {
    body: { status },
    mock: () => {
      adminOnly(viewer);
      const m = db.memberships.find((x) => x.id === id);
      if (!m) throw new ApiError(404, "Adhésion introuvable");
      if (m.status !== "pending") throw new ApiError(409, "Cette demande a déjà été traitée", { code: "ALREADY_DECIDED", conflicts: [] });
      if (status === "confirmed") {
        const club = clubById(m.clubId);
        if (club.members >= club.maxMembers) throw fullError(club);
        club.members += 1;
      }
      m.status = status;
      m.decidedAt = db.now();
      if (status === "confirmed") publishDomainEvent(SERVICE, "AdhésionConfirmée", `${m.memberName} · ${m.clubName}`);
      return clone(m);
    },
  });
  if (status === "confirmed") {
    publishDomainEvent(SERVICE, "AdhésionConfirmée", `${res.memberName} · ${res.clubName}`);
  }
  return res;
};

// ---------- Événements ----------

/** GET /events?clubId= — événements à venir, du plus proche au plus lointain. */
export const listEvents = (filters: EventFilters, viewer: Viewer, signal?: AbortSignal) => {
  const qs = toQuery({ clubId: filters.clubId });
  return api.get<CampusEvent[]>(`/events${qs}`, {
    signal,
    mock: () => {
      svc();
      void viewer;
      const today = todayISO();
      return clone(
        db.events
          .filter((e) => e.date >= today && (!filters.clubId || e.clubId === filters.clubId))
          .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
      );
    },
  });
};

/** POST /events (administrateur) */
export const createEvent = (input: EventInput, viewer: Viewer) =>
  api.post<CampusEvent>("/events", {
    body: input,
    mock: () => {
      adminOnly(viewer);
      if (input.date < todayISO()) throw new ApiError(422, "La date ne peut pas être dans le passé");
      if (toMinutes(input.end) <= toMinutes(input.start)) throw new ApiError(422, "La fin doit être après le début");
      const club = input.clubId ? clubById(input.clubId) : undefined;
      const created: CampusEvent = {
        id: `ev-${++db.seq}`,
        title: input.title.trim(),
        description: input.description.trim(),
        date: input.date,
        start: input.start,
        end: input.end,
        location: input.location.trim(),
        clubId: club?.id,
        clubName: club?.name,
      };
      db.events.push(created);
      return clone(created);
    },
  });


// ---------- Admin: Supprimer un club ----------

/** DELETE /clubs/{id} (administrateur) — supprime le club, ses adhésions et événements. */
export const deleteClub = (clubId: string, viewer: Viewer) =>
  api.delete<void>(`/clubs/${clubId}`, {
    mock: () => {
      adminOnly(viewer);
      const idx = db.clubs.findIndex((c) => c.id === clubId);
      if (idx === -1) throw new ApiError(404, "Club introuvable");
      db.memberships = db.memberships.filter((m) => m.clubId !== clubId);
      const eventIds = db.events.filter((e) => e.clubId === clubId).map((e) => e.id);
      db.events = db.events.filter((e) => e.clubId !== clubId);
      db.eventRegistrations = db.eventRegistrations.filter((r) => !eventIds.includes(r.eventId));
      const clubName = db.clubs[idx].name;
      db.clubs.splice(idx, 1);
      publishDomainEvent(SERVICE, "ClubSupprimé", clubName);
    },
  });

// ---------- Admin: Supprimer un événement ----------

/** DELETE /events/{id} (administrateur) — supprime l'événement et ses inscriptions. */
export const deleteEvent = (eventId: string, viewer: Viewer) =>
  api.delete<void>(`/events/${eventId}`, {
    mock: () => {
      adminOnly(viewer);
      const idx = db.events.findIndex((e) => e.id === eventId);
      if (idx === -1) throw new ApiError(404, "Événement introuvable");
      db.eventRegistrations = db.eventRegistrations.filter((r) => r.eventId !== eventId);
      db.events.splice(idx, 1);
    },
  });

// ---------- Admin: Lister les membres d'un club ----------

/** GET /clubs/{id}/members (administrateur) — liste des membres. */
export const listClubMembers = (clubId: string, viewer: Viewer, signal?: AbortSignal) =>
  api.get<MemberDetail[]>(`/clubs/${clubId}/members`, {
    signal,
    mock: () => {
      adminOnly(viewer);
      clubById(clubId);
      return clone(
        db.memberships
          .filter((m) => m.clubId === clubId)
          .map((m) => ({
            memberId: m.memberId,
            memberName: m.memberName,
            memberRole: m.memberRole,
            status: m.status,
            requestedAt: m.requestedAt,
            decidedAt: m.decidedAt,
          })),
      );
    },
  });

// ---------- Admin: Rapport annuel ----------

/** GET /reports/clubs/{id}?year= (administrateur) — rapport annuel d'un club. */
export const getClubReport = (clubId: string, year: number, viewer: Viewer, signal?: AbortSignal) =>
  api.get<ClubReport>(`/reports/clubs/${clubId}?year=${year}`, {
    signal,
    mock: () => {
      adminOnly(viewer);
      const club = clubById(clubId);
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const events = db.events.filter(
        (e) => e.clubId === clubId && e.date >= startDate && e.date <= endDate,
      );
      const memberships = db.memberships.filter((m) => m.clubId === clubId);
      return clone({
        clubId: club.id,
        clubName: club.name,
        category: club.category,
        year,
        totalMembers: memberships.length,
        confirmedMembers: memberships.filter((m) => m.status === "confirmed").length,
        pendingMembers: memberships.filter((m) => m.status === "pending").length,
        refusedMembers: memberships.filter((m) => m.status === "refused").length,
        totalEvents: events.length,
        events,
        members: memberships.map((m) => ({
          memberId: m.memberId,
          memberName: m.memberName,
          memberRole: m.memberRole,
          status: m.status,
          requestedAt: m.requestedAt,
          decidedAt: m.decidedAt,
        })),
      });
    },
  });

// ---------- Étudiant: Mes adhésions ----------

/** GET /memberships/mine — adhésions de l'utilisateur courant. */
export const listMyMemberships = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<Membership[]>("/memberships/mine", {
    signal,
    mock: () => {
      svc();
      if (!viewer.id) throw new ApiError(401, "Authentification requise");
      return clone(db.memberships.filter((m) => m.memberId === viewer.id));
    },
  });

// ---------- Étudiant: Inscription aux événements ----------

/** POST /events/{id}/register — s'inscrire à un événement. */
export const registerForEvent = (eventId: string, viewer: Viewer) =>
  api.post<EventRegistration>(`/events/${eventId}/register`, {
    mock: () => {
      svc();
      if (viewer.role === "admin") throw new ApiError(403, "Les administrateurs ne s'inscrivent pas aux événements");
      const event = db.events.find((e) => e.id === eventId);
      if (!event) throw new ApiError(404, "Événement introuvable");
      if (event.date < todayISO()) throw new ApiError(409, "Cet événement est déjà passé");
      if (db.eventRegistrations.some((r) => r.eventId === eventId && r.studentId === viewer.id)) {
        throw new ApiError(409, "Vous êtes déjà inscrit à cet événement");
      }
      const reg: EventRegistration = {
        id: `reg-${++db.seq}`,
        eventId,
        eventTitle: event.title,
        studentId: viewer.id,
        studentName: viewer.name,
        registeredAt: db.now(),
      };
      db.eventRegistrations.push(reg);
      return clone(reg);
    },
  });

/** DELETE /events/{id}/register — se désinscrire d'un événement. */
export const unregisterFromEvent = (eventId: string, viewer: Viewer) =>
  api.delete<void>(`/events/${eventId}/register`, {
    mock: () => {
      svc();
      const idx = db.eventRegistrations.findIndex(
        (r) => r.eventId === eventId && r.studentId === viewer.id,
      );
      if (idx === -1) throw new ApiError(404, "Inscription introuvable");
      db.eventRegistrations.splice(idx, 1);
    },
  });

/** GET /events/my-registrations — inscriptions de l'utilisateur courant. */
export const listMyRegistrations = (viewer: Viewer, signal?: AbortSignal) =>
  api.get<EventRegistration[]>("/events/my-registrations", {
    signal,
    mock: () => {
      svc();
      return clone(db.eventRegistrations.filter((r) => r.studentId === viewer.id));
    },
  });
