import type { Role } from "@/shared/auth/roles";

export const CATEGORIES = ["Technologie", "Culture", "Arts", "Sport", "Solidarité"] as const;
export type ClubCategory = (typeof CATEGORIES)[number];

export interface Club {
  id: string;
  name: string;
  category: ClubCategory;
  description: string;
  meetingPlace: string;
  /** Membres confirmés. */
  members: number;
  /** Nombre maximal de membres ; au-delà, l'adhésion est refusée (409). */
  maxMembers: number;
}

/** Statuts alignés sur StatusPill : En attente / Confirmé / Refusé. */
export type MembershipStatus = "pending" | "confirmed" | "refused";

export interface Membership {
  id: string;
  clubId: string;
  clubName: string;
  memberId: string;
  memberName: string;
  memberRole: Exclude<Role, "admin">;
  status: MembershipStatus;
  requestedAt: string;
  decidedAt?: string;
}

/** Club enrichi de l'état d'adhésion de l'utilisateur courant. */
export interface ClubView extends Club {
  myMembership?: { id: string; status: MembershipStatus };
}

export interface ClubFilters {
  q?: string;
  category?: string;
}

export interface ClubDetail extends ClubView {
  /** Noms des membres confirmés connus du service. */
  memberNames: string[];
  events: CampusEvent[];
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  start: string;
  end: string;
  location: string;
  clubId?: string;
  clubName?: string;
}

export interface EventFilters {
  clubId?: string;
}

export interface ClubInput {
  name: string;
  category: ClubCategory;
  description: string;
  meetingPlace: string;
  maxMembers: number;
}

export interface EventInput {
  title: string;
  description: string;
  date: string;
  start: string;
  end: string;
  location: string;
  clubId?: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  eventTitle: string;
  studentId: string;
  studentName: string;
  registeredAt: string;
}

export interface MemberDetail {
  memberId: string;
  memberName: string;
  memberRole: string;
  status: MembershipStatus;
  requestedAt: string;
  decidedAt?: string;
}

export interface ClubReport {
  clubId: string;
  clubName: string;
  category: string;
  year: number;
  totalMembers: number;
  confirmedMembers: number;
  pendingMembers: number;
  refusedMembers: number;
  totalEvents: number;
  events: CampusEvent[];
  members: MemberDetail[];
}
