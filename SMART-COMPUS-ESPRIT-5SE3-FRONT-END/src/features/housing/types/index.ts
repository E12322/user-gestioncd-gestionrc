// ---------------------------------------------------------------------------
// Contrat de données aligné sur le back-end NestJS (microservices Residences) :
//   GET/POST /chambres            → Chambre
//   POST /demandes, /demandes/... → Demande
//   /contrats/...                 → Contrat
// ---------------------------------------------------------------------------

export type ChambreType = "SIMPLE" | "DOUBLE" | "STUDIO";

export interface Chambre {
  id: string;
  numero: string;
  type: ChambreType;
  /** Nombre de residents par chambre. */
  capacite: number;
  disponible: boolean;
  batiment: string;
  etage: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChambreInput {
  numero: string;
  type: ChambreType;
  capacite: number;
  disponible?: boolean;
  batiment: string;
  etage: number;
}

export interface ChambreFilter {
  type?: ChambreType;
  batiment?: string;
  disponible?: boolean;
}

export type DemandeStatut = "EN_ATTENTE" | "APPROUVEE" | "REFUSEE" | "ANNULEE";

export interface Demande {
  id: string;
  etudiantId: string;
  statut: DemandeStatut;
  dateDepot: string;
  dateArrivee: string;
  dateDepart: string;
  chambreId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DemandeInput {
  etudiantId: string;
  dateArrivee: string;
  dateDepart: string;
  chambreId?: string;
}

export type ContratStatut = "ACTIF" | "TERMINE" | "RESILIE";

export interface Contrat {
  id: string;
  residentId: string;
  chambreId: string;
  demandeId: string;
  dateDebut: string;
  dateFin: string;
  /** Loyer mensuel en dinars, tarifé par type de chambre. */
  montantMensuel: number;
  statut: ContratStatut;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Maintenance (hors périmètre des 3 services) — service mocké du module.
// ---------------------------------------------------------------------------

export type TicketCategory = "plumbing" | "electricity" | "heating" | "internet" | "furniture" | "other";
export type TicketStatus = "open" | "in_progress" | "resolved";

export interface Ticket {
  id: string;
  studentId: string;
  studentName: string;
  /** Bâtiment concerné, ex. « Bâtiment A ». */
  batiment: string;
  /** Texte libre : « Chambre A-101 », « Cuisine commune »… */
  location: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketInput {
  batiment: string;
  location: string;
  category: TicketCategory;
  description: string;
}

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------

export const CHAMBRE_TYPES: readonly ChambreType[] = ["SIMPLE", "DOUBLE", "STUDIO"];
export const TICKET_CATEGORIES: readonly TicketCategory[] = ["plumbing", "electricity", "heating", "internet", "furniture", "other"];

/** Tarif mensuel par résident (TND) — doit rester aligné avec le Contrat service. */
export const MONTANT_MENSUEL_PAR_TYPE: Record<ChambreType, number> = {
  SIMPLE: 150,
  DOUBLE: 100,
  STUDIO: 200,
};

/** Capacité attendue par type : SIMPLE = 1, DOUBLE = 2, STUDIO ≤ 2. */
export function capaciteValide(type: ChambreType, capacite: number): boolean {
  if (type === "SIMPLE") return capacite === 1;
  if (type === "DOUBLE") return capacite === 2;
  return capacite >= 1 && capacite <= 2;
}
