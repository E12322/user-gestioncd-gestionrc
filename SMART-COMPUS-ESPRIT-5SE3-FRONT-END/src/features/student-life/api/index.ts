import { api } from "@/shared/api/client";
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
  ClubView,
  EventFilters,
  EventInput,
  Membership,
  MembershipStatus,
} from "../types";

/**
 * Stubs du club-service (via l'API Gateway). En production l'identité vient du JWT ;
 * en mock elle est passée explicitement (`Viewer`).
 * Erreurs : 403 interdit · 404 introuvable · 409 doublon / club complet · 422 saisie invalide.
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
export const listClubs = (filters: ClubFilters, viewer: Viewer, signal?: AbortSignal) =>
  api.get<ClubView[]>("/clubs", {
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
export const createClub = (input: ClubInput, viewer: Viewer) =>
  api.post<Club>("/clubs", {
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
export const decideMembership = (id: string, status: Exclude<MembershipStatus, "pending">, viewer: Viewer) =>
  api.put<Membership>(`/memberships/${id}/status`, {
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

// ---------- Événements ----------

/** GET /events?clubId= — événements à venir, du plus proche au plus lointain. */
export const listEvents = (filters: EventFilters, viewer: Viewer, signal?: AbortSignal) =>
  api.get<CampusEvent[]>("/events", {
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
