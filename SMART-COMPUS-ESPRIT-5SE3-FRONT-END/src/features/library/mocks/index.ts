import type { Role } from "@/shared/auth/roles";
import { addDays } from "../utils/time";
import type { Book, BookCategory, BookReservation, ReservationStatus } from "../types";

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const book = (
  id: string,
  title: string,
  author: string,
  category: BookCategory,
  year: number,
  isbn: string,
  copies: number,
  description: string,
): Book => ({
  id,
  title,
  author,
  category,
  year,
  isbn,
  copies,
  description,
});

const seedBooks = (): Book[] => [
  book(
    "b1",
    "Building Microservices",
    "Sam Newman",
    "Informatique",
    2021,
    "978-1492034025",
    3,
    "Concevoir, découper et faire évoluer des systèmes distribués : le guide de référence sur l'architecture microservices.",
  ),
  book(
    "b2",
    "Clean Architecture",
    "Robert C. Martin",
    "Informatique",
    2017,
    "978-0134494166",
    2,
    "Les principes d'une architecture logicielle maintenable, indépendante des frameworks et des bases de données.",
  ),
  book(
    "b3",
    "Designing Data-Intensive Applications",
    "Martin Kleppmann",
    "Informatique",
    2017,
    "978-1449373320",
    2,
    "Fiabilité, passage à l'échelle et maintenabilité des systèmes de données modernes.",
  ),
  book(
    "b4",
    "Introduction aux probabilités",
    "Sheldon Ross",
    "Sciences",
    2014,
    "978-2889150069",
    4,
    "Cours complet de probabilités avec de nombreux exercices corrigés.",
  ),
  book(
    "b5",
    "Algorithmique",
    "Thomas H. Cormen",
    "Informatique",
    2010,
    "978-2100545261",
    3,
    "Une introduction complète aux algorithmes et à leur analyse.",
  ),
  book(
    "b6",
    "Le Marketing numérique",
    "Philip Kotler",
    "Gestion",
    2019,
    "978-2744066443",
    2,
    "Stratégies de marque, données clients et plateformes à l'ère du numérique.",
  ),
  book(
    "b7",
    "English for Information Technology",
    "Maja Olejniczak",
    "Langues",
    2012,
    "978-1408269930",
    5,
    "Vocabulaire et communication professionnelle en anglais pour l'informatique.",
  ),
  book("b8", "L'Étranger", "Albert Camus", "Littérature", 1942, "978-2070360024", 4, "Le roman emblématique d'Albert Camus."),
  book(
    "b9",
    "Les Misérables",
    "Victor Hugo",
    "Littérature",
    1862,
    "978-2070409228",
    2,
    "La grande fresque de Victor Hugo sur la misère et la justice.",
  ),
  book(
    "b10",
    "Physique générale",
    "Douglas Giancoli",
    "Sciences",
    2018,
    "978-2807308526",
    3,
    "Mécanique, ondes, électricité et optique, avec des applications concrètes.",
  ),
  book(
    "b11",
    "Refactoring",
    "Martin Fowler",
    "Informatique",
    2018,
    "978-0134757599",
    2,
    "Améliorer la conception d'un code existant par petites étapes sûres.",
  ),
  book(
    "b12",
    "Gestion de projet agile",
    "Jim Highsmith",
    "Gestion",
    2009,
    "978-0321658395",
    3,
    "Piloter un projet avec Scrum, Kanban et les méthodes agiles.",
  ),
];

const WHO = {
  yasmine: ["ETU-2024-0187", "Yasmine Ben Salah", "student"],
  amine: ["ETU-2024-0211", "Amine Khelifi", "student"],
  ines: ["ETU-2024-0302", "Inès Bouzid", "student"],
  omar: ["ETU-2023-0644", "Omar Dridi", "student"],
  rim: ["ETU-2025-0019", "Rim Zouari", "student"],
  karim: ["ENS-0042", "Karim Trabelsi", "teacher"],
} as const satisfies Record<string, readonly [string, string, Role]>;

/** Prêt « brut » du mock ; le statut et les jours de retard sont calculés par l'API. */
export interface StoredLoan {
  id: string;
  bookId: string;
  borrowerId: string;
  borrowerName: string;
  borrowerRole: Role;
  borrowedAt: string;
  dueDate: string;
  returnedAt?: string;
  renewals: number;
}

let lid = 0;
const loan = (
  who: readonly [string, string, Role],
  bookId: string,
  borrowedDaysAgo: number,
  dueInDays: number,
  extra: Partial<StoredLoan> = {},
): StoredLoan => ({
  id: `l-${++lid}`,
  bookId,
  borrowerId: who[0],
  borrowerName: who[1],
  borrowerRole: who[2],
  borrowedAt: addDays(-borrowedDaysAgo),
  dueDate: addDays(dueInDays),
  renewals: 0,
  ...extra,
});

const seedLoans = (): StoredLoan[] => [
  // Yasmine (étudiante de démo) : deux prêts en cours (l'un proche de l'échéance) et un historique
  loan(WHO.yasmine, "b1", 9, 5),
  loan(WHO.yasmine, "b5", 13, 1),
  loan(WHO.yasmine, "b8", 60, -46, { returnedAt: addDays(-48) }),
  // Clean Architecture : les 2 exemplaires sont sortis (dont un en retard) → réservation possible
  loan(WHO.amine, "b2", 20, -6),
  loan(WHO.omar, "b2", 5, 9),
  // Autres prêts en cours
  loan(WHO.karim, "b3", 10, 20, { borrowerRole: "teacher" }),
  loan(WHO.ines, "b4", 3, 11),
  loan(WHO.rim, "b7", 7, 7),
  loan(WHO.rim, "b10", 40, -26, { returnedAt: addDays(-24) }),
];

let rid = 0;
const reservation = (
  who: readonly [string, string, Role],
  bookId: string,
  daysAgo: number,
  status: ReservationStatus,
  books: Book[],
): BookReservation => ({
  id: `r-${++rid}`,
  bookId,
  bookTitle: books.find((b) => b.id === bookId)!.title,
  memberId: who[0],
  memberName: who[1],
  status,
  createdAt: iso(daysAgo),
});

const books = seedBooks();

const seedReservations = (): BookReservation[] => [
  reservation(WHO.rim, "b2", 4, "waiting", books),
  reservation(WHO.yasmine, "b2", 1, "waiting", books),
];

/** « Base de données » en mémoire du library-service fictif. */
export const db = {
  books,
  loans: seedLoans(),
  reservations: seedReservations(),
  seq: 100,
  now: () => new Date().toISOString(),
};

/** Durée de prêt (jours) et plafond de prêts simultanés par profil. */
export const LOAN_RULES: Record<Role, { days: number; limit: number }> = {
  student: { days: 14, limit: 3 },
  teacher: { days: 30, limit: 5 },
  admin: { days: 30, limit: 5 },
};
