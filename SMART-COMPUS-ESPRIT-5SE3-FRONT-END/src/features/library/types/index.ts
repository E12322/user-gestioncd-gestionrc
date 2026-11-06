import type { Role } from "@/shared/auth/roles";

export const BOOK_CATEGORIES = ["Informatique", "Sciences", "Gestion", "Langues", "Littérature"] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: BookCategory;
  year: number;
  description: string;
  /** Nombre d'exemplaires possédés. */
  copies: number;
}

export type ReservationStatus = "waiting" | "ready";

/** Réservation d'un ouvrage indisponible : file d'attente, puis « prêt à retirer » quand un exemplaire revient. */
export interface BookReservation {
  id: string;
  bookId: string;
  bookTitle: string;
  memberId: string;
  memberName: string;
  status: ReservationStatus;
  createdAt: string;
  /** Rang dans la file (1 = prochain). Renseigné quand la réservation est « en attente ». */
  position?: number;
}

/** Livre enrichi de sa disponibilité et de l'état de l'utilisateur courant. */
export interface BookView extends Book {
  /** Exemplaires empruntables immédiatement. */
  available: number;
  waiting: number;
  myLoanId?: string;
  myReservation?: { id: string; status: ReservationStatus; position?: number };
}

export type LoanStatus = "active" | "overdue" | "returned";

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  borrowerId: string;
  borrowerName: string;
  borrowerRole: Role;
  /** "YYYY-MM-DD" */
  borrowedAt: string;
  dueDate: string;
  returnedAt?: string;
  renewals: number;
  status: LoanStatus;
  /** Jours de retard (prêt en retard ou rendu en retard). */
  daysLate: number;
}

export interface MyLibrary {
  loans: Loan[];
  reservations: BookReservation[];
  /** Plafond de prêts simultanés pour ce profil. */
  limit: number;
}

export interface BookFilters {
  q?: string;
  category?: string;
  availableOnly?: boolean;
}

export interface BookInput {
  title: string;
  author: string;
  isbn: string;
  category: BookCategory;
  year: number;
  copies: number;
  description: string;
}

export const MAX_RENEWALS = 2;
