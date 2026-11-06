export type RoomKind = "amphi" | "classroom" | "lab" | "meeting";

export interface Equipment {
  id: string;
  label: string;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: number;
  kind: RoomKind;
  capacity: number;
  equipment: Equipment[];
}

/** Salle enrichie de son occupation du jour (heures réservées / heures d'ouverture). */
export interface RoomView extends Room {
  bookedHoursToday: number;
  openHours: number;
}

export interface RoomFilters {
  q?: string;
  building?: string;
  /** Capacité minimale. */
  minCapacity?: number;
}

/** Statuts alignés sur StatusPill : En attente / Confirmé / Refusé. */
export type ReservationStatus = "pending" | "confirmed" | "refused";

export interface Reservation {
  id: string;
  roomId: string;
  roomName: string;
  building: string;
  requesterId: string;
  requesterName: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  start: string;
  end: string;
  attendees: number;
  purpose: string;
  status: ReservationStatus;
  requestedAt: string;
  decidedAt?: string;
}

export interface ReservationInput {
  roomId: string;
  date: string;
  start: string;
  end: string;
  attendees: number;
  purpose: string;
}

/** Créneau occupé d'une salle pour une journée (sans données personnelles). */
export interface BusySlot {
  start: string;
  end: string;
  status: Exclude<ReservationStatus, "refused">;
}

export interface Availability {
  roomId: string;
  date: string;
  slots: BusySlot[];
}

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 19;
export const OPEN_HOURS = CLOSE_HOUR - OPEN_HOUR;
