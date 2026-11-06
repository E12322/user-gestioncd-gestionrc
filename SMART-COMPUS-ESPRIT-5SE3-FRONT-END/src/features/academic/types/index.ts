/** Jour de cours : 1 = lundi … 6 = samedi. */
export type Day = 1 | 2 | 3 | 4 | 5 | 6;
export type SessionKind = "CM" | "TD" | "TP";
export type Semester = "S1" | "S2";

export interface Session {
  id: string;
  courseId: string;
  day: Day;
  /** "HH:MM" */
  start: string;
  end: string;
  room: string;
  kind: SessionKind;
}

export interface ExternalResource {
  id?: string;
  type: "file" | "url" | "video" | "document";
  title: string;
  url?: string;
  fileName?: string;
  fileSize?: string;
  format?: "PDF" | "PPTX" | "DOCX" | "ZIP" | "MP4" | "WEB" | string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  department: string;
  semester: Semester;
  credits: number;
  teacherId: string;
  teacherName: string;
  capacity: number;
  enrolled: number;
  /** Nature du cours : OBLIGATOIRE (affecté par groupe) ou OPTIONNEL (inscription libre). */
  nature?: "OBLIGATOIRE" | "OPTIONNEL";
  sessions: Session[];
  /** Contenu magistral complet, syllabus, chapitres ou code source */
  content?: string;
  /** Support vidéo indépendant (fichier MP4 ou URL YouTube/streaming) */
  videoResource?: ExternalResource;
  /** Document PDF ou support de cours indépendant (PDF, Word, PPT) */
  documentResource?: ExternalResource;
  /** Support de cours externe (rétro-compatibilité) */
  externalResource?: ExternalResource;
  /** Liste multiple de documents & supports pédagogiques (PDF, Word, PPT, Vidéo, Archive, etc.) */
  documents?: ExternalResource[];
}

/** Statuts alignés sur StatusPill : En attente / Validé / Refusé. */
export type EnrollmentStatus = "pending" | "validated" | "refused";

export interface Enrollment {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  status: EnrollmentStatus;
  /** GROUPE (automatique par classe) ou LIBRE (choix optionnel) */
  source?: "GROUPE" | "LIBRE";
  groupId?: string;
  groupName?: string;
  requestedAt: string;
  decidedAt?: string;
}

/** Cours enrichi de l'état d'inscription de l'utilisateur courant (étudiant). */
export interface CourseView extends Course {
  myEnrollment?: EnrollmentStatus;
  myEnrollmentSource?: "GROUPE" | "LIBRE";
  groupName?: string;
}

export interface CourseFilters {
  q?: string;
  department?: string;
  /** Restreint aux cours d'un enseignant. */
  teacherId?: string;
  teacherName?: string;
}

export interface TimetableEntry extends Session {
  courseCode: string;
  courseTitle: string;
  teacherName: string;
  /** Groupe concerné (TD/TP), si la séance est réservée à un groupe. */
  groupId?: string;
  groupName?: string;
  /** Identifiant backend de l'enseignant ( Séance.enseignantId ). */
  teacherId?: string;
}

/** Salle du référentiel back ( /academic/v1/rooms ). */
export interface Room {
  id: string;
  nom: string;
  batiment?: string;
  capacite: number;
}

/** Groupe de séance du référentiel back ( /academic/v1/groups ). */
export interface GroupInfo {
  id: string;
  nom: string;
  kind: SessionKind;
  coursId?: string;
  capacite: number;
  /** Effectif actuel de la classe. */
  effectif?: number;
  /** Étudiants membres de la classe. */
  etudiants?: EtudiantRef[];
  /** Cours suivis par la classe (CM/TD/TP). */
  affectations?: AffectationInfo[];
}

/** Cours affecté à une classe (avec type de séance). */
export interface AffectationInfo {
  coursId: string;
  coursCode?: string | null;
  coursIntitule: string;
  enseignantNom?: string | null;
  kind: SessionKind;
}

/** Étudiant membre d'une classe (groupe). */
export interface EtudiantRef {
  etudiantId: string;
  nom: string;
}

/** Création / modification d'une séance d'emploi du temps ( SeanceRequestDTO ). */
export interface SessionInput {
  coursId: string;
  groupeId?: string;
  salleId: string;
  enseignantId?: string;
  kind: SessionKind;
  day: Day;
  /** "HH:MM" */
  start: string;
  end: string;
}

export interface GradeEntry {
  studentId: string;
  studentName: string;
  value: number | null;
  published: boolean;
}

export interface CourseGrades {
  course: Pick<Course, "id" | "code" | "title" | "credits">;
  entries: GradeEntry[];
}

export interface MyGrade {
  courseId: string;
  code: string;
  title: string;
  credits: number;
  teacherName: string;
  /** null = pas encore publiée. */
  value: number | null;
}

export interface GradeSummary {
  items: MyGrade[];
  /** Moyenne pondérée par les crédits, sur les notes publiées. */
  average: number | null;
  creditsEarned: number;
  creditsTotal: number;
}

export const DAY_LABELS: Record<Day, string> = { 1: "Lundi", 2: "Mardi", 3: "Mercredi", 4: "Jeudi", 5: "Vendredi", 6: "Samedi" };
export const PASS_MARK = 10;

export interface Absence {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  seance: "CM" | "TD" | "TP" | string;
  dateAbsence: string;
  justifiee: boolean;
}

export interface AbsenceFilters {
  courseId?: string;
  studentId?: string;
}

export interface StudentAcademicResult {
  studentId: string;
  studentName: string;
  coursesCount: number;
  gradesCount: number;
  average: number | null;
  creditsEarned: number;
  creditsTotal: number;
  absencesCount: number;
}
