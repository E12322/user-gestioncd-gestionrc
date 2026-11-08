import type { Chambre, ChambreType, Contrat, Demande, Ticket, TicketCategory, TicketStatus } from "../types";
import { addDays } from "../utils/time";

/**
 * « Base de données » en mémoire du housing-service fictif.
 * Les règles métier (transitions, occupation, contrats) vivent dans `api/` ;
 * ce module ne contient que les données et leur génération.
 */

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const BATIMENTS: { prefix: string; name: string; floors: number }[] = [
  { prefix: "A", name: "Bâtiment A", floors: 3 },
  { prefix: "B", name: "Bâtiment B", floors: 2 },
  { prefix: "C", name: "Bâtiment C", floors: 2 },
];

/** Chambres 1 et 4 : SIMPLE et STUDIO ; chambres 2 et 3 : DOUBLE. */
const typeOfSlot = (slot: number): ChambreType => (slot === 1 ? "SIMPLE" : slot === 4 ? "STUDIO" : "DOUBLE");
const capaciteOfType = (type: ChambreType) => (type === "DOUBLE" ? 2 : 1);

function buildChambres(): Chambre[] {
  const chambres: Chambre[] = [];
  for (const b of BATIMENTS) {
    for (let floor = 0; floor < b.floors; floor++) {
      for (let slot = 1; slot <= 4; slot++) {
        const numero = `${b.prefix}-${floor}${String(slot).padStart(2, "0")}`;
        const type = typeOfSlot(slot);
        chambres.push({
          id: numero,
          numero,
          type,
          capacite: capaciteOfType(type),
          disponible: true,
          batiment: b.name,
          etage: floor,
          createdAt: daysAgo(120),
          updatedAt: daysAgo(120),
        });
      }
    }
  }
  return chambres;
}

type SeedDemande = Omit<Demande, "createdAt" | "updatedAt"> & { depotBack: number };

const SEED_DEMANDES: SeedDemande[] = [
  // Yasmine (étudiante de démo) : demande en attente, annulable.
  {
    id: "d-1",
    etudiantId: "ETU-2024-0187",
    statut: "EN_ATTENTE",
    dateDepot: daysAgo(8),
    dateArrivee: "2026-11-01",
    dateDepart: "2027-06-30",
    chambreId: null,
    depotBack: 8,
  },
  {
    id: "d-2",
    etudiantId: "ETU-2024-0211",
    statut: "EN_ATTENTE",
    dateDepot: daysAgo(5),
    dateArrivee: "2026-10-20",
    dateDepart: "2027-06-30",
    chambreId: null,
    depotBack: 5,
  },
  // Inès : demande approuvée → chambre A-002 occupée + contrat actif.
  {
    id: "d-3",
    etudiantId: "ETU-2024-0302",
    statut: "APPROUVEE",
    dateDepot: daysAgo(22),
    dateArrivee: "2026-09-01",
    dateDepart: "2027-06-30",
    chambreId: "A-002",
    depotBack: 22,
  },
  {
    id: "d-4",
    etudiantId: "ETU-2023-0644",
    statut: "REFUSEE",
    dateDepot: daysAgo(14),
    dateArrivee: "2026-10-01",
    dateDepart: "2027-01-31",
    chambreId: null,
    depotBack: 14,
  },
  {
    id: "d-5",
    etudiantId: "ETU-2025-0019",
    statut: "ANNULEE",
    dateDepot: daysAgo(30),
    dateArrivee: "2026-10-01",
    dateDepart: "2027-06-30",
    chambreId: null,
    depotBack: 30,
  },
  // Mariem : demande approuvée → chambre B-001 occupée + contrat actif.
  {
    id: "d-6",
    etudiantId: "ETU-2024-0455",
    statut: "APPROUVEE",
    dateDepot: daysAgo(40),
    dateArrivee: "2026-10-01",
    dateDepart: "2027-06-30",
    chambreId: "B-001",
    depotBack: 40,
  },
];

const SEED_CONTRATS: Contrat[] = [
  {
    id: "k-1",
    residentId: "ETU-2024-0302",
    chambreId: "A-002",
    demandeId: "d-3",
    dateDebut: "2026-09-01",
    dateFin: "2027-06-30",
    montantMensuel: 100,
    statut: "ACTIF",
    createdAt: daysAgo(22),
    updatedAt: daysAgo(22),
  },
  {
    id: "k-2",
    residentId: "ETU-2024-0455",
    chambreId: "B-001",
    demandeId: "d-6",
    dateDebut: "2026-10-01",
    dateFin: "2027-06-30",
    montantMensuel: 150,
    statut: "ACTIF",
    createdAt: daysAgo(40),
    updatedAt: daysAgo(40),
  },
];

let ticketSeq = 0;
const ticket = (
  studentId: string,
  studentName: string,
  batiment: string,
  location: string,
  category: TicketCategory,
  description: string,
  status: TicketStatus,
  back: number,
): Ticket => ({
  id: `t-${++ticketSeq}`,
  studentId,
  studentName,
  batiment,
  location,
  category,
  description,
  status,
  createdAt: daysAgo(back),
  updatedAt: daysAgo(status === "open" ? back : Math.max(0, back - 1)),
});

const SEED_TICKETS: Ticket[] = [
  ticket(
    "ETU-2024-0187",
    "Yasmine Ben Salah",
    "Bâtiment A",
    "Cuisine commune, 2e étage",
    "plumbing",
    "Le robinet de l'évier fuit en continu.",
    "in_progress",
    6,
  ),
  ticket(
    "ETU-2024-0187",
    "Yasmine Ben Salah",
    "Bâtiment A",
    "Chambre A-302",
    "internet",
    "Le Wi-Fi se coupe chaque soir vers 21 h.",
    "open",
    1,
  ),
  ticket("ETU-2024-0211", "Amine Khelifi", "Bâtiment A", "Chambre A-101", "heating", "Le radiateur ne chauffe plus.", "open", 2),
  ticket(
    "ETU-2024-0302",
    "Inès Bouzid",
    "Bâtiment B",
    "Chambre B-201",
    "electricity",
    "La prise près du bureau ne fonctionne pas.",
    "resolved",
    10,
  ),
  ticket("ETU-2024-0455", "Mariem Sfaxi", "Bâtiment C", "Salle d'étude", "furniture", "Deux chaises sont cassées.", "resolved", 15),
];

function seedChambres(): Chambre[] {
  const chambres = buildChambres();
  for (const occupiedNumero of ["A-002", "B-001"]) {
    const room = chambres.find((c) => c.numero === occupiedNumero);
    if (room) {
      room.disponible = false;
      room.updatedAt = daysAgo(20);
    }
  }
  return chambres;
}

export const db = {
  chambres: seedChambres(),
  demandes: SEED_DEMANDES.map(({ depotBack, ...d }) => ({
    ...d,
    createdAt: daysAgo(depotBack),
    updatedAt: daysAgo(depotBack),
  })) as Demande[],
  contrats: [...SEED_CONTRATS],
  tickets: [...SEED_TICKETS],
  seq: 100,
  nextId: (prefix: string) => `${prefix}-${++db.seq}`,
  now: () => new Date().toISOString(),
  /** Date repère pour les formulaires de démonstration. */
  inDays: (n: number) => addDays(n),
};
