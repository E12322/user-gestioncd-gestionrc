import { addDays } from "../utils/time";
import type { CampusEvent, Club, ClubCategory, Membership, MembershipStatus } from "../types";

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const club = (
  id: string,
  name: string,
  category: ClubCategory,
  members: number,
  maxMembers: number,
  meetingPlace: string,
  description: string,
): Club => ({
  id,
  name,
  category,
  members,
  maxMembers,
  meetingPlace,
  description,
});

const seedClubs = (): Club[] => [
  club(
    "k1",
    "Club Robotique",
    "Technologie",
    48,
    60,
    "Labo B, Bloc B",
    "Conception et programmation de robots, participation aux concours nationaux et ateliers d'initiation ouverts à tous.",
  ),
  club(
    "k2",
    "Club Théâtre",
    "Arts",
    30,
    30,
    "Amphi B, Bloc A",
    "Ateliers d'improvisation, mise en scène et représentations de fin de semestre devant le campus.",
  ),
  club(
    "k3",
    "Club Photographie",
    "Arts",
    22,
    40,
    "Salle C14, Bloc C",
    "Sorties photo, retouche et expositions. Du smartphone au reflex, tous les niveaux sont accueillis.",
  ),
  club(
    "k4",
    "Club Échecs",
    "Culture",
    18,
    25,
    "Espace projet P2, Bloc B",
    "Parties libres, tournois internes et préparation aux compétitions universitaires.",
  ),
  club(
    "k5",
    "Club Football",
    "Sport",
    54,
    70,
    "Terrain du campus",
    "Entraînements hebdomadaires, championnat inter-écoles et matchs amicaux.",
  ),
  club(
    "k6",
    "Solidarité Campus",
    "Solidarité",
    36,
    80,
    "Salle C12, Bloc C",
    "Collectes, tutorat entre étudiants et actions de bénévolat avec des associations locales.",
  ),
  club(
    "k7",
    "Club IA & Data",
    "Technologie",
    41,
    50,
    "Labo Réseaux, Bloc C",
    "Projets d'apprentissage automatique, lectures d'articles et hackathons de données.",
  ),
];

const NAMES = {
  yasmine: ["ETU-2024-0187", "Yasmine Ben Salah", "student"],
  amine: ["ETU-2024-0211", "Amine Khelifi", "student"],
  ines: ["ETU-2024-0302", "Inès Bouzid", "student"],
  omar: ["ETU-2023-0644", "Omar Dridi", "student"],
  rim: ["ETU-2025-0019", "Rim Zouari", "student"],
  mariem: ["ETU-2024-0455", "Mariem Sfaxi", "student"],
  karim: ["ENS-0042", "Karim Trabelsi", "teacher"],
  salma: ["ENS-0017", "Salma Ayari", "teacher"],
} as const;

let mid = 0;
const membership = (
  who: readonly [string, string, "student" | "teacher"],
  clubId: string,
  status: MembershipStatus,
  daysAgo: number,
  clubs: Club[],
): Membership => ({
  id: `m-${++mid}`,
  clubId,
  clubName: clubs.find((c) => c.id === clubId)!.name,
  memberId: who[0],
  memberName: who[1],
  memberRole: who[2],
  status,
  requestedAt: iso(daysAgo),
  decidedAt: status === "pending" ? undefined : iso(Math.max(0, daysAgo - 1)),
});

const clubs = seedClubs();

const seedMemberships = (): Membership[] => [
  // Yasmine (étudiante de démo) : membre de la Robotique, demande en attente à la Photographie
  membership(NAMES.yasmine, "k1", "confirmed", 60, clubs),
  membership(NAMES.yasmine, "k3", "pending", 2, clubs),
  membership(NAMES.amine, "k1", "confirmed", 55, clubs),
  membership(NAMES.mariem, "k1", "confirmed", 40, clubs),
  membership(NAMES.karim, "k7", "confirmed", 30, clubs),
  membership(NAMES.salma, "k7", "confirmed", 25, clubs),
  membership(NAMES.ines, "k2", "confirmed", 45, clubs),
  // File de validation de l'administrateur
  membership(NAMES.amine, "k4", "pending", 3, clubs),
  membership(NAMES.omar, "k5", "pending", 2, clubs),
  membership(NAMES.rim, "k6", "pending", 1, clubs),
  membership(NAMES.ines, "k7", "pending", 1, clubs),
  membership(NAMES.omar, "k3", "refused", 12, clubs),
];

let eid = 0;
const event = (
  clubId: string | undefined,
  title: string,
  dayOffset: number,
  start: string,
  end: string,
  location: string,
  description: string,
  clubs: Club[],
): CampusEvent => ({
  id: `ev-${++eid}`,
  title,
  description,
  date: addDays(dayOffset),
  start,
  end,
  location,
  clubId,
  clubName: clubs.find((c) => c.id === clubId)?.name,
});

const seedEvents = (): CampusEvent[] => [
  event(
    undefined,
    "Journée d'accueil des clubs",
    2,
    "10:00",
    "16:00",
    "Esplanade du campus",
    "Tous les clubs présentent leurs activités. Venez les rencontrer et vous inscrire.",
    clubs,
  ),
  event(
    "k1",
    "Atelier : premiers pas en robotique",
    3,
    "14:00",
    "17:00",
    "Labo B, Bloc B",
    "Assemblage d'un robot suiveur de ligne. Aucun prérequis.",
    clubs,
  ),
  event(
    "k4",
    "Tournoi d'échecs du semestre",
    5,
    "13:30",
    "18:00",
    "Espace projet P2, Bloc B",
    "Tournoi en 5 rondes ouvert à tous les niveaux.",
    clubs,
  ),
  event(
    "k2",
    "Représentation : « Le Malade imaginaire »",
    8,
    "18:30",
    "20:30",
    "Amphi B, Bloc A",
    "Soirée de théâtre ouverte à toute la communauté du campus.",
    clubs,
  ),
  event(
    "k6",
    "Collecte de fournitures scolaires",
    9,
    "09:00",
    "15:00",
    "Hall du Bloc C",
    "Déposez cahiers et stylos pour les écoles partenaires.",
    clubs,
  ),
  event(
    "k7",
    "Hackathon de données",
    14,
    "09:00",
    "19:00",
    "Labo Réseaux, Bloc C",
    "Une journée pour résoudre un défi de données avec des équipes de quatre.",
    clubs,
  ),
  event("k5", "Match inter-écoles", 16, "15:00", "17:00", "Terrain du campus", "Rencontre amicale contre l'école voisine.", clubs),
];

/** « Base de données » en mémoire du club-service fictif. */
export const db = {
  clubs,
  memberships: seedMemberships(),
  events: seedEvents(),
  seq: 100,
  now: () => new Date().toISOString(),
};
