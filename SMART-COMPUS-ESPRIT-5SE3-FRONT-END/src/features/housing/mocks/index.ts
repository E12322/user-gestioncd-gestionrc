import { addDays } from "../utils/time";
import type { HousingRequest, HousingRoom, RequestStatus, Residence, RoomType, Ticket, TicketCategory, TicketStatus } from "../types";

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

interface Spec {
  id: string;
  name: string;
  address: string;
  walkMinutes: number;
  monthlyRent: number;
  amenities: string[];
  floors: number;
  perFloor: number;
  /** Lits occupés au départ. */
  occupied: number;
}

const SPECS: Spec[] = [
  {
    id: "h1",
    name: "Résidence Les Oliviers",
    address: "12 avenue de l'Université",
    walkMinutes: 5,
    monthlyRent: 120,
    amenities: ["Wi-Fi", "Cuisine commune", "Salle d'étude", "Buanderie"],
    floors: 4,
    perFloor: 10,
    occupied: 54,
  },
  {
    id: "h2",
    name: "Résidence El Manar",
    address: "3 rue des Jasmins",
    walkMinutes: 12,
    monthlyRent: 95,
    amenities: ["Wi-Fi", "Cuisine commune", "Parking vélos"],
    floors: 3,
    perFloor: 8,
    occupied: 22,
  },
  {
    id: "h3",
    name: "Résidence Les Jasmins",
    address: "Campus nord, bloc E",
    walkMinutes: 2,
    monthlyRent: 140,
    amenities: ["Wi-Fi", "Salle de sport", "Salle d'étude", "Accès PMR"],
    floors: 2,
    perFloor: 6,
    occupied: 20,
  },
];

/** Une chambre sur trois est individuelle, les autres sont doubles. Les lits sont occupés dans l'ordre des numéros. */
function buildRooms(spec: Spec): HousingRoom[] {
  const rooms: HousingRoom[] = [];
  let left = spec.occupied;
  for (let floor = 1; floor <= spec.floors; floor++) {
    for (let i = 0; i < spec.perFloor; i++) {
      const type: RoomType = i % 3 === 0 ? "single" : "double";
      const beds = type === "single" ? 1 : 2;
      const occupants = Math.min(beds, left);
      left -= occupants;
      rooms.push({
        id: `${spec.id}-${floor}${String(i + 1).padStart(2, "0")}`,
        residenceId: spec.id,
        number: `${floor}${String(i + 1).padStart(2, "0")}`,
        floor,
        type,
        beds,
        occupants,
      });
    }
  }
  return rooms;
}

const residenceBase = (): Omit<Residence, "capacity" | "occupied">[] =>
  SPECS.map(({ id, name, address, walkMinutes, monthlyRent, amenities }) => ({ id, name, address, walkMinutes, monthlyRent, amenities }));

const STUDENTS: Record<string, string> = {
  "ETU-2024-0187": "Yasmine Ben Salah",
  "ETU-2024-0211": "Amine Khelifi",
  "ETU-2024-0302": "Inès Bouzid",
  "ETU-2023-0644": "Omar Dridi",
  "ETU-2025-0019": "Rim Zouari",
  "ETU-2024-0455": "Mariem Sfaxi",
};

const residenceName = (id: string) => SPECS.find((s) => s.id === id)!.name;

let qid = 0;
const request = (
  studentId: string,
  residenceId: string,
  roomType: RoomType,
  status: RequestStatus,
  daysAgo: number,
  extra: Partial<HousingRequest> = {},
): HousingRequest => ({
  id: `q-${++qid}`,
  studentId,
  studentName: STUDENTS[studentId]!,
  residenceId,
  residenceName: residenceName(residenceId),
  roomType,
  entryDate: addDays(30),
  durationMonths: 9,
  accessibility: false,
  notes: "",
  status,
  requestedAt: iso(daysAgo),
  decidedAt: status === "pending" ? undefined : iso(Math.max(0, daysAgo - 2)),
  ...extra,
});

const seedRequests = (): HousingRequest[] => [
  // Yasmine (étudiante de démo) : une demande en attente, annulable pour rejouer le parcours en 4 étapes
  request("ETU-2024-0187", "h1", "double", "pending", 8, { notes: "Proche de la bibliothèque si possible." }),
  request("ETU-2024-0211", "h1", "single", "pending", 5),
  // Résidence pleine : l'administrateur doit réorienter la demande vers une autre résidence
  request("ETU-2024-0302", "h3", "single", "pending", 4, { accessibility: true, notes: "Mobilité réduite : rez-de-chaussée demandé." }),
  request("ETU-2023-0644", "h2", "double", "pending", 2),
  request("ETU-2025-0019", "h2", "double", "confirmed", 20, { assignedResidenceName: residenceName("h2"), assignedRoomNumber: "101" }),
  request("ETU-2024-0455", "h1", "single", "refused", 14),
];

let tid = 0;
const ticket = (
  studentId: string,
  residenceId: string,
  location: string,
  category: TicketCategory,
  description: string,
  status: TicketStatus,
  daysAgo: number,
): Ticket => ({
  id: `t-${++tid}`,
  studentId,
  studentName: STUDENTS[studentId]!,
  residenceId,
  residenceName: residenceName(residenceId),
  location,
  category,
  description,
  status,
  createdAt: iso(daysAgo),
  updatedAt: iso(status === "open" ? daysAgo : Math.max(0, daysAgo - 1)),
});

const seedTickets = (): Ticket[] => [
  ticket("ETU-2024-0187", "h1", "Cuisine commune, 2e étage", "plumbing", "Le robinet de l'évier fuit en continu.", "in_progress", 6),
  ticket("ETU-2024-0187", "h1", "Chambre 204", "internet", "Le Wi-Fi se coupe chaque soir vers 21 h.", "open", 1),
  ticket("ETU-2024-0211", "h1", "Chambre 301", "heating", "Le radiateur ne chauffe plus.", "open", 2),
  ticket("ETU-2025-0019", "h2", "Chambre 101", "electricity", "La prise près du bureau ne fonctionne pas.", "resolved", 10),
  ticket("ETU-2024-0455", "h3", "Salle d'étude", "furniture", "Deux chaises sont cassées.", "resolved", 15),
];

/** « Base de données » en mémoire du housing-service fictif. */
export const db = {
  residences: residenceBase(),
  rooms: SPECS.flatMap(buildRooms),
  requests: seedRequests(),
  tickets: seedTickets(),
  seq: 100,
  now: () => new Date().toISOString(),
};
