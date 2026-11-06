export type RoomType = "single" | "double";

export interface HousingRoom {
  id: string;
  residenceId: string;
  /** Numéro affiché, ex. « 204 ». */
  number: string;
  floor: number;
  type: RoomType;
  beds: number;
  occupants: number;
}

export interface Residence {
  id: string;
  name: string;
  address: string;
  /** Distance à pied du campus, en minutes. */
  walkMinutes: number;
  /** Loyer mensuel par lit, en dinars. */
  monthlyRent: number;
  amenities: string[];
  /** Lits au total / lits occupés (calculés à partir des chambres). */
  capacity: number;
  occupied: number;
}

/** Statuts alignés sur StatusPill : En attente / Confirmé (= chambre affectée) / Refusé. */
export type RequestStatus = "pending" | "confirmed" | "refused";

export interface HousingRequest {
  id: string;
  studentId: string;
  studentName: string;
  residenceId: string;
  residenceName: string;
  roomType: RoomType;
  /** "YYYY-MM-DD" */
  entryDate: string;
  durationMonths: number;
  accessibility: boolean;
  notes: string;
  status: RequestStatus;
  requestedAt: string;
  decidedAt?: string;
  /** Renseignés une fois la chambre affectée. */
  assignedResidenceName?: string;
  assignedRoomNumber?: string;
}

export interface HousingRequestInput {
  residenceId: string;
  roomType: RoomType;
  entryDate: string;
  durationMonths: number;
  accessibility: boolean;
  notes: string;
}

export type TicketCategory = "plumbing" | "electricity" | "heating" | "internet" | "furniture" | "other";
export type TicketStatus = "open" | "in_progress" | "resolved";

/** Signalement de panne ; l'administrateur les traite (pas de rôle Technicien). */
export interface Ticket {
  id: string;
  studentId: string;
  studentName: string;
  residenceId: string;
  residenceName: string;
  /** Texte libre : « Chambre 204 », « Cuisine commune »… */
  location: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  residenceId: string;
  location: string;
  category: TicketCategory;
  description: string;
}

export const ROOM_TYPES: readonly RoomType[] = ["single", "double"];
export const TICKET_CATEGORIES: readonly TicketCategory[] = ["plumbing", "electricity", "heating", "internet", "furniture", "other"];
export const DURATIONS = [3, 6, 9, 12] as const;
