import { addDays } from "../utils/time";
import type { Equipment, Reservation, ReservationStatus, Room, RoomKind } from "../types";

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000).toISOString();

export const EQUIPMENT: Record<string, Equipment> = {
  projector: { id: "projector", label: "Vidéoprojecteur" },
  mic: { id: "mic", label: "Micro et sonorisation" },
  pcs: { id: "pcs", label: "Postes informatiques" },
  network: { id: "network", label: "Baie réseau et switchs" },
  video: { id: "video", label: "Visioconférence" },
  board: { id: "board", label: "Tableau interactif" },
  whiteboard: { id: "whiteboard", label: "Tableau blanc" },
  ac: { id: "ac", label: "Climatisation" },
};

const eq = (...ids: (keyof typeof EQUIPMENT)[]) => ids.map((id) => EQUIPMENT[id]!);
const room = (
  id: string,
  name: string,
  building: string,
  floor: number,
  kind: RoomKind,
  capacity: number,
  equipment: Equipment[],
): Room => ({
  id,
  name,
  building,
  floor,
  kind,
  capacity,
  equipment,
});

// Les noms de salles sont ceux utilisés par l'emploi du temps du module Académique.
const seedRooms = (): Room[] => [
  room("r1", "Amphi A", "Bloc A", 0, "amphi", 220, eq("projector", "mic", "ac")),
  room("r2", "Amphi B", "Bloc A", 1, "amphi", 150, eq("projector", "mic", "ac")),
  room("r3", "Salle C12", "Bloc C", 1, "classroom", 40, eq("projector", "whiteboard")),
  room("r4", "Salle C14", "Bloc C", 1, "classroom", 35, eq("board", "whiteboard")),
  room("r5", "Labo Réseaux", "Bloc C", 0, "lab", 30, eq("pcs", "network", "projector")),
  room("r6", "Labo B", "Bloc B", 0, "lab", 28, eq("pcs", "projector", "ac")),
  room("r7", "Salle de conférence", "Bloc D", 2, "meeting", 80, eq("projector", "mic", "video", "ac")),
  room("r8", "Salle de réunion R1", "Bloc D", 1, "meeting", 12, eq("video", "board")),
  room("r9", "Espace projet P2", "Bloc B", 1, "meeting", 16, eq("whiteboard", "projector")),
];

const ENS = {
  karim: ["ENS-0042", "Karim Trabelsi"],
  salma: ["ENS-0017", "Salma Ayari"],
  hichem: ["ENS-0031", "Hichem Belhaj"],
  marc: ["ENS-0063", "Marc Dubois"],
} as const;

let rid = 0;
const rsv = (
  who: readonly [string, string],
  roomId: string,
  dayOffset: number,
  start: string,
  end: string,
  attendees: number,
  purpose: string,
  status: ReservationStatus,
  requestedHoursAgo: number,
  rooms: Room[],
): Reservation => {
  const r = rooms.find((x) => x.id === roomId)!;
  return {
    id: `rs-${++rid}`,
    roomId,
    roomName: r.name,
    building: r.building,
    requesterId: who[0],
    requesterName: who[1],
    date: addDays(dayOffset),
    start,
    end,
    attendees,
    purpose,
    status,
    requestedAt: iso(requestedHoursAgo),
    decidedAt: status === "pending" ? undefined : iso(Math.max(1, requestedHoursAgo - 6)),
  };
};

const rooms = seedRooms();

const seedReservations = (): Reservation[] => [
  // Karim (enseignant de démo) : une confirmée, une en attente, une refusée
  rsv(ENS.karim, "r5", 1, "14:00", "16:00", 28, "TP supplémentaire — architecture des microservices", "confirmed", 72, rooms),
  rsv(ENS.karim, "r7", 5, "09:00", "11:30", 60, "Soutenances de projets", "pending", 5, rooms),
  rsv(ENS.karim, "r1", 3, "08:00", "10:00", 200, "Conférence invitée sur la sécurité", "refused", 96, rooms),
  // Autres enseignants : créneaux déjà pris (sources de conflits 409)
  rsv(ENS.salma, "r1", 1, "14:00", "16:00", 120, "Cours magistral — Intelligence artificielle", "confirmed", 120, rooms),
  rsv(ENS.hichem, "r3", 0, "10:00", "12:00", 38, "Révisions avant examen", "confirmed", 100, rooms),
  rsv(ENS.marc, "r2", 0, "14:00", "17:00", 90, "Atelier d'anglais professionnel", "confirmed", 80, rooms),
  rsv(ENS.salma, "r6", 2, "09:00", "12:00", 25, "Examen pratique", "confirmed", 60, rooms),
  rsv(ENS.hichem, "r7", 4, "13:00", "15:00", 45, "Réunion pédagogique du département", "confirmed", 50, rooms),
  // File de validation de l'administrateur : deux demandes se chevauchent sur le même créneau
  rsv(ENS.hichem, "r2", 6, "10:00", "12:00", 110, "Cours de rattrapage — Génie logiciel", "pending", 3, rooms),
  rsv(ENS.marc, "r2", 6, "11:00", "13:00", 70, "Séminaire d'économie numérique", "pending", 2, rooms),
  rsv(ENS.salma, "r4", 2, "15:00", "17:00", 30, "Jury de projets de fin d'études", "pending", 1, rooms),
];

/** « Base de données » en mémoire du resource-service fictif. */
export const db = {
  rooms,
  reservations: seedReservations(),
  seq: 100,
  now: () => new Date().toISOString(),
};

export const BUILDINGS = [...new Set(rooms.map((r) => r.building))].sort();
export const CAPACITY_STEPS = [0, 20, 40, 80, 150] as const;
