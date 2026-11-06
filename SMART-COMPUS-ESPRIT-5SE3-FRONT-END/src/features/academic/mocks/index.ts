import type { Course, Day, Enrollment, EnrollmentStatus, Session, SessionKind, ExternalResource } from "../types";

const NOW = new Date("2026-10-11T09:30:00+01:00").getTime();
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString();

let sid = 0;
const s = (courseId: string, day: Day, start: string, end: string, room: string, kind: SessionKind): Session => ({
  id: `s-${++sid}`,
  courseId,
  day,
  start,
  end,
  room,
  kind,
});

const course = (
  id: string,
  code: string,
  title: string,
  department: string,
  credits: number,
  teacher: [string, string],
  capacity: number,
  enrolled: number,
  description: string,
  sessions: Session[],
  documentResource?: ExternalResource,
): Course => ({
  id,
  code,
  title,
  department,
  credits,
  semester: "S1",
  teacherId: teacher[0],
  teacherName: teacher[1],
  capacity,
  enrolled,
  description,
  sessions,
  documentResource,
});

const KARIM: [string, string] = ["ENS-0042", "Karim Trabelsi"];
const SALMA: [string, string] = ["ENS-0017", "Salma Ayari"];
const HICHEM: [string, string] = ["ENS-0031", "Hichem Belhaj"];
const MARC: [string, string] = ["ENS-0063", "Marc Dubois"];

export const COURSES_STORAGE_KEY = "smartcampus.academic.custom_courses";

export const seedCourses = (): Course[] => [
  course(
    "c1",
    "INF-301",
    "Architecture des microservices",
    "Informatique",
    4,
    KARIM,
    40,
    36,
    "Conception d'architectures distribuées : découpage en services, API Gateway, communication synchrone et asynchrone, résilience et observabilité.",
    [s("c1", 2, "10:00", "12:00", "Amphi A", "CM"), s("c1", 4, "14:00", "16:00", "Labo Réseaux", "TP")],
  ),
  course(
    "c2",
    "MAT-210",
    "Probabilités et statistiques",
    "Mathématiques",
    3,
    SALMA,
    60,
    52,
    "Variables aléatoires, lois usuelles, estimation et tests d'hypothèses appliqués aux données du campus.",
    [s("c2", 1, "08:30", "10:00", "Amphi B", "CM"), s("c2", 3, "10:00", "11:30", "Salle C12", "TD")],
  ),
  course(
    "c3",
    "ANG-102",
    "Anglais technique",
    "Langues",
    2,
    MARC,
    30,
    24,
    "Communication professionnelle en anglais : rédaction de rapports, présentations et lecture de documentation technique.",
    [s("c3", 5, "09:00", "10:30", "Salle C14", "TD")],
  ),
  course(
    "c4",
    "BD-220",
    "Bases de données avancées",
    "Informatique",
    4,
    HICHEM,
    45,
    41,
    "Optimisation de requêtes, transactions, index, bases NoSQL et modélisation pour les systèmes distribués.",
    [s("c4", 1, "10:30", "12:00", "Labo B", "TP"), s("c4", 3, "14:00", "16:00", "Amphi A", "CM")],
  ),
  course(
    "c5",
    "RES-310",
    "Réseaux et sécurité",
    "Informatique",
    3,
    KARIM,
    35,
    29,
    "Protocoles réseau, pare-feu, chiffrement et authentification (JWT, OAuth2) dans les architectures web.",
    [s("c5", 2, "14:00", "16:00", "Labo Réseaux", "TP"), s("c5", 4, "08:30", "10:00", "Salle C12", "CM")],
  ),
  course(
    "c6",
    "IA-340",
    "Intelligence artificielle",
    "Informatique",
    4,
    SALMA,
    40,
    33,
    "Apprentissage supervisé, réseaux de neurones et éthique de l'IA, avec projets sur des jeux de données réels.",
    [s("c6", 2, "10:00", "11:30", "Salle C14", "CM"), s("c6", 6, "09:00", "11:00", "Labo B", "TP")],
  ),
  course(
    "c7",
    "GL-250",
    "Génie logiciel",
    "Informatique",
    3,
    HICHEM,
    45,
    38,
    "Méthodes agiles, tests, intégration continue et qualité du code, en équipe sur un projet fil rouge.",
    [s("c7", 5, "10:30", "12:00", "Amphi B", "CM"), s("c7", 6, "11:15", "12:45", "Labo B", "TP")],
  ),
  course(
    "c8",
    "ECO-120",
    "Économie numérique",
    "Gestion",
    2,
    MARC,
    80,
    61,
    "Modèles économiques des plateformes, données et valeur, transformation numérique des organisations.",
    [s("c8", 3, "08:30", "10:00", "Amphi A", "CM")],
  ),
  course(
    "c9",
    "DEV-205",
    "Développement web",
    "Informatique",
    4,
    KARIM,
    30,
    30,
    "Interfaces modernes avec React et TypeScript, accessibilité, performance et consommation d'API REST.",
    [s("c9", 1, "14:00", "16:00", "Labo B", "TP"), s("c9", 4, "10:30", "12:00", "Salle C14", "TD")],
  ),
  course(
    "c10",
    "PRJ-400",
    "Projet de fin d'études",
    "Informatique",
    6,
    SALMA,
    20,
    12,
    "Projet encadré de bout en bout : cadrage, développement, soutenance devant jury.",
    [s("c10", 5, "14:00", "17:00", "Salle C12", "TD")],
    {
      title: "PFE Book Officiel",
      url: "/uploads/pfe%20book%201.pdf",
      format: "PDF",
      type: "document",
      fileName: "pfe book 1.pdf",
      fileSize: "5.48 Mo",
    },
  ),
];

export function loadStoredCourses(): Course[] {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(COURSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normaliser tout lien vers 'pfe book 1.pdf' ou blob expiré vers l'upload réel
          parsed.forEach((c: Partial<Course>) => {
            if (
              c.documentResource &&
              (c.documentResource.fileName === "pfe book 1.pdf" || (c.documentResource.url && c.documentResource.url.includes("pfe")))
            ) {
              c.documentResource.url = "/uploads/pfe%20book%201.pdf";
            }
            if (
              c.externalResource &&
              (c.externalResource.fileName === "pfe book 1.pdf" || (c.externalResource.url && c.externalResource.url.includes("pfe")))
            ) {
              c.externalResource.url = "/uploads/pfe%20book%201.pdf";
            }
          });
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn("Erreur lecture cours localStorage:", e);
  }
  const initial = seedCourses();
  saveStoredCourses(initial);
  return initial;
}

export function saveStoredCourses(coursesToSave: Course[]): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(coursesToSave));
    }
  } catch (e) {
    console.warn("Erreur sauvegarde cours localStorage:", e);
  }
}

const STUDENTS: Record<string, string> = {
  "ETU-2024-0187": "Yasmine Ben Salah",
  "ETU-2024-0211": "Amine Khelifi",
  "ETU-2024-0302": "Inès Bouzid",
  "ETU-2023-0644": "Omar Dridi",
  "ETU-2025-0019": "Rim Zouari",
  "ETU-2024-0455": "Mariem Sfaxi",
  "ETU-2025-0101": "Skander Ouertani",
};

let eid = 0;
const enrollment = (studentId: string, courseId: string, status: EnrollmentStatus, daysAgo: number, coursesList: Course[]): Enrollment => {
  const c = coursesList.find((x) => x.id === courseId) || coursesList[0];
  return {
    id: `e-${++eid}`,
    courseId: c ? c.id : courseId,
    courseCode: c ? c.code : "CODE",
    courseTitle: c ? c.title : "Titre",
    studentId,
    studentName: STUDENTS[studentId] || "Étudiant",
    status,
    requestedAt: iso(daysAgo),
    decidedAt: status === "pending" ? undefined : iso(Math.max(0, daysAgo - 1)),
  };
};

const initialCourses = loadStoredCourses();

const seedEnrollments = (): Enrollment[] => [
  enrollment("ETU-2024-0187", "c1", "validated", 40, initialCourses),
  enrollment("ETU-2024-0187", "c2", "validated", 40, initialCourses),
  enrollment("ETU-2024-0187", "c3", "validated", 39, initialCourses),
  enrollment("ETU-2024-0187", "c4", "validated", 39, initialCourses),
  enrollment("ETU-2024-0187", "c5", "pending", 3, initialCourses),
  enrollment("ETU-2024-0211", "c1", "validated", 40, initialCourses),
  enrollment("ETU-2024-0455", "c1", "validated", 38, initialCourses),
  enrollment("ETU-2024-0302", "c1", "validated", 38, initialCourses),
  enrollment("ETU-2024-0211", "c2", "validated", 40, initialCourses),
  enrollment("ETU-2024-0302", "c2", "validated", 37, initialCourses),
  enrollment("ETU-2024-0211", "c5", "pending", 2, initialCourses),
  enrollment("ETU-2024-0302", "c5", "pending", 1, initialCourses),
  enrollment("ETU-2023-0644", "c7", "pending", 4, initialCourses),
  enrollment("ETU-2025-0019", "c8", "refused", 9, initialCourses),
  enrollment("ETU-2025-0101", "c10", "pending", 1, initialCourses),
];

const seedGrades = (): Map<string, { value: number | null; published: boolean }> =>
  new Map([
    ["c1:ETU-2024-0187", { value: 15.5, published: true }],
    ["c1:ETU-2024-0211", { value: 12, published: true }],
    ["c1:ETU-2024-0455", { value: 9, published: true }],
    ["c1:ETU-2024-0302", { value: 17, published: false }],
    ["c2:ETU-2024-0187", { value: 13, published: true }],
    ["c3:ETU-2024-0187", { value: 16, published: true }],
    ["c4:ETU-2024-0187", { value: 12.5, published: false }],
  ]);

export const db = {
  courses: initialCourses,
  enrollments: seedEnrollments(),
  grades: seedGrades(),
  seq: 100,
  now: () => new Date().toISOString(),
};

export const DEPARTMENTS = [...new Set(initialCourses.map((c) => c.department))].sort();
