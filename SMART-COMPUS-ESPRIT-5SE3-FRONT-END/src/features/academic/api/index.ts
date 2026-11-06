import { api, API_BASE_URL, USE_MOCKS } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import type { Role } from "@/shared/auth/roles";
import { normalize } from "@/shared/lib/format";
import { publishDomainEvent } from "@/shared/events/domainEvents";
import { db, saveStoredCourses } from "../mocks";
import { AcademicService } from "./academicService";
import type { BackendCoursDTO, BackendNoteDTO } from "./academicService";
import type {
  Absence,
  AbsenceFilters,
  AffectationInfo,
  Course,
  CourseFilters,
  CourseGrades,
  CourseView,
  Day,
  Enrollment,
  EnrollmentStatus,
  ExternalResource,
  GradeSummary,
  GroupInfo,
  Room,
  Session,
  SessionInput,
  SessionKind,
  Semester,
  TimetableEntry,
} from "../types";

/**
 * Stubs de l'academic-service (via l'API Gateway). En production l'identité vient du JWT ;
 * en mock elle est passée explicitement (`Viewer`).
 * Erreurs : 404 introuvable · 403 interdit · 409 conflit (horaire, cours complet, doublon).
 */
export interface Viewer {
  id: string;
  name: string;
  role: Role;
}

const SERVICE = "academic-service";
const svc = () => {};
const clone = <T>(x: T): T => structuredClone(x);

function courseById(id: string) {
  let c = db.courses.find((x) => x.id === id);
  if (!c) {
    const numericPart = id.replace(/\D/g, "");
    if (numericPart) {
      c = db.courses.find((x) => x.id === `pg-${numericPart}` || x.id === `c${numericPart}` || x.id === numericPart);
    }
  }
  if (!c) throw new ApiError(404, "Cours introuvable");
  return c;
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const overlaps = (a: Session, b: Session) =>
  a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

const enrollmentFor = (courseId: string, studentId: string) =>
  db.enrollments.find((e) => e.courseId === courseId && e.studentId === studentId);

const withState = (c: Course, viewerId: string): CourseView => ({ ...c, myEnrollment: enrollmentFor(c.id, viewerId)?.status });

// ---------- Cours ----------

/** GET /courses?q=&department=&teacherId= */
export const listCourses = (filters: CourseFilters, viewer: Viewer, signal?: AbortSignal): Promise<CourseView[]> => {
  // Mode réel : uniquement les cours et inscriptions de la base de données (aucune donnée fictive).
  if (!USE_MOCKS) {
    return fetchRealCourses(signal).then(async (courses) => {
      const list = clone(appliquerFiltres(courses, filters)).map((c) => ({ ...c, myEnrollment: undefined }) as CourseView);
      try {
        const etudiantId = viewer.role === "student" ? numId(viewer.id) : undefined;
        // Charger toutes les inscriptions pour avoir les vraies places occupées (countByCoursIdAndStatut validated)
        const [inscriptions, groups] = await Promise.all([
          api.get<InscriptionBackendDTO[]>("/academic/v1/enrollments", { signal }).catch(() => [] as InscriptionBackendDTO[]),
          api.get<{ content?: GroupeBackendDTO[] } | GroupeBackendDTO[]>("/academic/v1/groups?size=100", { signal })
            .then((res) => (Array.isArray(res) ? res : res.content ?? []))
            .catch(() => [] as GroupeBackendDTO[]),
        ]);

        const valides = new Map<number, number>();
        const groupMap = new Map<number, string>();
        for (const g of groups) {
          if (g.id) groupMap.set(g.id, g.nom);
        }

        // Places occupées calculées à partir de countByCoursIdAndStatut(validated)
        for (const i of inscriptions) {
          if (i.status === "validated") {
            valides.set(i.coursId, (valides.get(i.coursId) ?? 0) + 1);
          }
        }

        return list.map((c) => {
          const cNum = numId(c.id) ?? -1;
          const myInsc = etudiantId
            ? inscriptions.find((i) => i.coursId === cNum && i.etudiantId === etudiantId)
            : undefined;

          // Déduire le nom du groupe d'affectation
          let groupName: string | undefined = undefined;
          if (myInsc?.groupeId) {
            groupName = groupMap.get(myInsc.groupeId);
          }
          if (!groupName && etudiantId) {
            const matchingGroup = groups.find(
              (g) =>
                (g.coursId === cNum || (g.affectations ?? []).some((a) => a.coursId === cNum)) &&
                (g.etudiants ?? []).some((e) => e.etudiantId === etudiantId),
            );
            if (matchingGroup) groupName = matchingGroup.nom;
          }

          return {
            ...c,
            enrolled: valides.get(cNum) ?? 0,
            myEnrollment: myInsc?.status,
            myEnrollmentSource: myInsc?.source || (groupName ? "GROUPE" : "LIBRE"),
            groupName,
          };
        });
      } catch {
        // Inscriptions indisponibles : le catalogue reste affiché
        return list;
      }
    });
  }
  return api.get<CourseView[]>("/courses", {
    signal,
    mock: async () => {
      svc();

      // Synchronisation bidirectionnelle avec PostgreSQL via Spring Boot
      try {
        const backendCourses = await AcademicService.getCours();
        if (backendCourses && Array.isArray(backendCourses)) {
          let updated = false;
          backendCourses.forEach((bc) => {
            const backendId = `pg-${bc.id}`;
            const existingIdx = db.courses.findIndex(
              (c) => c.id === backendId || (bc.id && c.id === String(bc.id)) || (bc.code && c.code === bc.code),
            );

            let videoResource: ExternalResource | undefined = undefined;
            if (bc.videoUrl || bc.videoNomFichier) {
              videoResource = {
                type: "video",
                title: bc.videoTitre || "Support Vidéo",
                url: bc.videoUrl,
                fileName: bc.videoNomFichier,
                fileSize: bc.videoTaille,
                format: bc.videoFormat || "MP4",
              };
            }

            let documentResource: ExternalResource | undefined = undefined;
            if (bc.documentUrl || bc.documentNomFichier) {
              documentResource = {
                type: "file",
                title: bc.documentTitre || "Support Document PDF",
                url: bc.documentUrl,
                fileName: bc.documentNomFichier,
                fileSize: bc.documentTaille,
                format: bc.documentFormat || "PDF",
              };
            }

            const code = bc.code || (bc.intitule.includes(" - ") ? bc.intitule.split(" - ")[0].trim() : `COU-${bc.id || Date.now()}`);
            const title = bc.intitule.includes(" - ") ? bc.intitule.split(" - ").slice(1).join(" - ").trim() : bc.intitule;

            const mapped: Course = {
              id: backendId,
              code,
              title,
              department: bc.departement || "Informatique",
              credits: bc.credits ?? 3,
              semester: (bc.semestre as "S1" | "S2") || "S1",
              teacherId: bc.enseignantId ? `ENS-${bc.enseignantId}` : "ENS-0042",
              teacherName: bc.enseignantNom || "Enseignant ESPRIT",
              capacity: bc.capacite ?? 40,
              enrolled: 0,
              description: bc.description || "Cours officiel persistant enregistré dans PostgreSQL.",
              content: bc.contenu || "",
              videoResource,
              documentResource,
              externalResource: videoResource || documentResource,
              sessions: [
                {
                  id: `s-pg-${bc.id}`,
                  courseId: backendId,
                  day: 1,
                  start: "09:00",
                  end: "11:00",
                  room: "Salle B12",
                  kind: "CM",
                },
              ],
            };

            if (existingIdx !== -1) {
              const prev = db.courses[existingIdx];
              db.courses[existingIdx] = {
                ...prev,
                ...mapped,
                // Préserver les ressources et contenus locaux si non fournis par le backend
                content: mapped.content || prev.content || "",
                videoResource: mapped.videoResource || prev.videoResource,
                documentResource: mapped.documentResource || prev.documentResource,
                externalResource: mapped.externalResource || prev.externalResource,
                sessions: prev.sessions?.length ? prev.sessions : mapped.sessions,
              };
            } else {
              db.courses.unshift(mapped);
            }
            updated = true;
          });
          if (updated) {
            saveStoredCourses(db.courses);
          }
        }
      } catch {
        // En cas de backend hors ligne, db.courses chargé de localStorage reste intact et persistant !
      }

      const q = normalize(filters.q?.trim() ?? "");
      return clone(
        db.courses
          .filter(
            (c) =>
              (!filters.department || c.department === filters.department) &&
              (!filters.teacherId || c.teacherId === filters.teacherId) &&
              (!q || normalize(`${c.code} ${c.title} ${c.teacherName}`).includes(q)),
          )
          .map((c) => withState(c, viewer.id)),
      );
    },
  });
};

/** GET /academic/v1/courses/{id} (réel) · mock en mode démo. */
export const getCourse = (id: string, viewer: Viewer, signal?: AbortSignal): Promise<CourseView> => {
  const numericId = id.replace(/\D/g, "") || id;
  if (!USE_MOCKS) {
    return Promise.all([
      api.get<CoursBackendDTO>(`/academic/v1/courses/${numericId}`, { signal }),
      api.get<PageResult<SeanceBackendDTO>>(`/academic/v1/sessions?size=100&coursId=${numericId}`, { signal }).catch(() => ({
        content: [] as SeanceBackendDTO[],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      })),
    ])
      .then(async ([c, seances]) => {
        const course = mapCoursDTOToCourse(
          c as CoursBackendDTO,
          (seances?.content ?? []).map(mapSeanceDTOToSession).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
        ) as CourseView;
        if (viewer.role !== "student") return course;
        try {
          const etudiantId = numId(viewer.id);
          const suffix = etudiantId ? `?etudiantId=${etudiantId}` : "";
          const inscriptions = await api.get<InscriptionBackendDTO[]>(`/academic/v1/enrollments${suffix}`, { signal });
          return { ...course, myEnrollment: inscriptions.find((i) => i.coursId === numId(id))?.status };
        } catch {
          return { ...course, myEnrollment: undefined };
        }
      })
      .catch((e) => Promise.reject(e instanceof ApiError ? e : new ApiError(0, "Cours indisponible (backend académique injoignable)")));
  }
  return api.get<CourseView>(`/courses/${id}`, {
    signal,
    mock: () => {
      svc();
      return clone(withState(courseById(id), viewer.id));
    },
  });
};

export interface CreateCoursePayload {
  code: string;
  title: string;
  department: string;
  credits: number;
  semester?: "S1" | "S2";
  teacherName?: string;
  teacherId?: string;
  capacity: number;
  description?: string;
  content?: string;
  videoResource?: ExternalResource;
  documentResource?: ExternalResource;
  externalResource?: ExternalResource;
  documents?: ExternalResource[];
}

/** POST /academic/v1/courses (réel) · mock en mode démo. */
export const createCourse = (payload: CreateCoursePayload, viewer: Viewer): Promise<Course> => {
  if (!USE_MOCKS) {
    return api.post<CoursBackendDTO>("/academic/v1/courses", { body: coursPayloadToDTO(payload) }).then((c) => mapCoursDTOToCourse(c));
  }
  return api.post<Course>("/courses", {
    body: payload,
    mock: async () => {
      svc();
      if (viewer.role !== "admin") throw new ApiError(403, "Seul l'administrateur peut créer un cours");

      let backendId: number | undefined;
      try {
        const res = await AcademicService.creerCours({
          code: payload.code.toUpperCase().trim(),
          intitule: payload.title.trim(),
          departement: payload.department,
          credits: Number(payload.credits) || 3,
          semestre: payload.semester || "S1",
          enseignantId: payload.teacherId ? Number(payload.teacherId.replace(/\D/g, "")) || 1 : 1,
          enseignantNom: payload.teacherName || viewer.name,
          capacite: Number(payload.capacity) || 40,
          description: payload.description,
          contenu: payload.content,
          videoTitre: payload.videoResource?.title,
          videoUrl: payload.videoResource?.url,
          videoNomFichier: payload.videoResource?.fileName,
          videoTaille: payload.videoResource?.fileSize,
          videoFormat: payload.videoResource?.format,
          documentTitre: payload.documentResource?.title,
          documentUrl: payload.documentResource?.url,
          documentNomFichier: payload.documentResource?.fileName,
          documentTaille: payload.documentResource?.fileSize,
          documentFormat: payload.documentResource?.format,
        });
        if (res && res.id) {
          backendId = res.id;
        }
      } catch (e) {
        console.warn("Spring Boot hors-ligne, persistance locale sécurisée:", e);
      }

      const id = backendId ? `pg-${backendId}` : `c${Date.now()}`;
      const newCourse: Course = {
        id,
        code: payload.code.toUpperCase().trim(),
        title: payload.title.trim(),
        department: payload.department,
        credits: Number(payload.credits) || 3,
        semester: payload.semester || "S1",
        teacherId: payload.teacherId || "ENS-0042",
        teacherName: payload.teacherName || "Karim Trabelsi",
        capacity: Number(payload.capacity) || 40,
        enrolled: 0,
        description: payload.description || "Aucune description fournie.",
        content: payload.content || "",
        videoResource: payload.videoResource,
        documentResource: payload.documentResource,
        externalResource: payload.externalResource || payload.videoResource || payload.documentResource,
        documents: payload.documents || ([payload.documentResource, payload.videoResource].filter(Boolean) as ExternalResource[]),
        sessions: [
          {
            id: `s-${Date.now()}`,
            courseId: id,
            day: 2,
            start: "10:00",
            end: "12:00",
            room: "Salle C14",
            kind: "CM",
          },
        ],
      };

      db.courses.unshift(newCourse);
      saveStoredCourses(db.courses);
      return clone(newCourse);
    },
  });
};

/** PUT /academic/v1/courses/{id} (réel) · mock en mode démo. */
export const updateCourse = (id: string, payload: Partial<CreateCoursePayload>, _viewer: Viewer): Promise<Course> => {
  const cleanId = id.replace(/\D/g, "") || id;
  if (!USE_MOCKS) {
    return api
      .put<CoursBackendDTO>(`/academic/v1/courses/${cleanId}`, { body: coursPayloadToDTO(payload) })
      .then((c) => mapCoursDTOToCourse(c))
      .catch(async (e) => {
        console.warn("[SmartCampus] Fallback local pour updateCourse:", e);
        const existing = courseById(id);
        if (payload.code !== undefined) existing.code = payload.code.toUpperCase().trim();
        if (payload.title !== undefined) existing.title = payload.title.trim();
        if (payload.department !== undefined) existing.department = payload.department;
        if (payload.credits !== undefined) existing.credits = Number(payload.credits);
        if (payload.capacity !== undefined) existing.capacity = Number(payload.capacity);
        if (payload.teacherName !== undefined) existing.teacherName = payload.teacherName;
        if (payload.description !== undefined) existing.description = payload.description;
        if (payload.content !== undefined) existing.content = payload.content;
        if (payload.documents !== undefined) existing.documents = payload.documents;
        saveStoredCourses(db.courses);
        return existing;
      });
  }
  return api.put<Course>(`/courses/${id}`, {
    body: payload,
    mock: async () => {
      svc();
      const existing = courseById(id);
      if (payload.code !== undefined) existing.code = payload.code.toUpperCase().trim();
      if (payload.title !== undefined) existing.title = payload.title.trim();
      if (payload.department !== undefined) existing.department = payload.department;
      if (payload.credits !== undefined) existing.credits = Number(payload.credits);
      if (payload.capacity !== undefined) existing.capacity = Number(payload.capacity);
      if (payload.teacherName !== undefined) existing.teacherName = payload.teacherName;
      if (payload.description !== undefined) existing.description = payload.description;
      if (payload.content !== undefined) existing.content = payload.content;
      if (payload.videoResource !== undefined) existing.videoResource = payload.videoResource;
      if (payload.documentResource !== undefined) existing.documentResource = payload.documentResource;
      if (payload.externalResource !== undefined) existing.externalResource = payload.externalResource;
      if (payload.documents !== undefined) existing.documents = payload.documents;

      // Synchronisation avec la base PostgreSQL
      const cleanNumericId = Number(id.replace(/\D/g, ""));
      if (!isNaN(cleanNumericId) && cleanNumericId > 0) {
        try {
          await AcademicService.modifierCours(cleanNumericId, {
            code: existing.code,
            intitule: existing.title,
            departement: existing.department,
            credits: existing.credits,
            semestre: existing.semester,
            enseignantId: existing.teacherId ? Number(existing.teacherId.replace(/\D/g, "")) || 1 : 1,
            enseignantNom: existing.teacherName,
            capacite: existing.capacity,
            description: existing.description,
            contenu: existing.content,
            videoTitre: existing.videoResource?.title,
            videoUrl: existing.videoResource?.url,
            videoNomFichier: existing.videoResource?.fileName,
            videoTaille: existing.videoResource?.fileSize,
            videoFormat: existing.videoResource?.format,
            documentTitre: existing.documentResource?.title,
            documentUrl: existing.documentResource?.url,
            documentNomFichier: existing.documentResource?.fileName,
            documentTaille: existing.documentResource?.fileSize,
            documentFormat: existing.documentResource?.format,
          });
        } catch (e) {
          console.warn("Backend Spring Boot update non synchrone:", e);
        }
      }

      saveStoredCourses(db.courses);
      return clone(existing);
    },
  });
};

/** DELETE /academic/v1/courses/{id} (réel) · mock en mode démo. */
export const deleteCourse = (id: string, viewer: Viewer): Promise<{ success: boolean }> => {
  const cleanId = id.replace(/\D/g, "") || id;
  if (!USE_MOCKS) {
    return api
      .delete<void>(`/academic/v1/courses/${cleanId}`)
      .then(() => ({ success: true }))
      .catch(async () => {
        const idx = db.courses.findIndex((x) => x.id === id || x.id === `pg-${cleanId}`);
        if (idx !== -1) {
          db.courses.splice(idx, 1);
          saveStoredCourses(db.courses);
        }
        return { success: true };
      });
  }
  return api.delete<{ success: boolean }>(`/courses/${id}`, {
    mock: async () => {
      svc();
      if (viewer.role !== "admin") throw new ApiError(403, "Seul l'administrateur peut supprimer un cours");
      const idx = db.courses.findIndex((x) => x.id === id);
      if (idx !== -1) {
        db.courses.splice(idx, 1);
        saveStoredCourses(db.courses);
      }

      // Synchronisation de la suppression en base PostgreSQL
      const cleanNumericId = Number(id.replace(/\D/g, ""));
      if (!isNaN(cleanNumericId) && cleanNumericId > 0) {
        try {
          await AcademicService.supprimerCours(cleanNumericId);
        } catch (e) {
          console.warn("Backend Spring Boot suppression non synchrone:", e);
        }
      }

      return { success: true };
    },
  });
};

// ---------- Ponts vers le backend réel (aucune donnée de démonstration) ----------

/** Identifiant numérique d'un id front ("pg-12" → 12, "ETU-2026-0002" → 20260002). */
const numId = (id?: string | null): number | undefined => {
  const digits = (id ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Inscription telle que renvoyée par /academic/v1/enrollments (InscriptionResponseDTO). */
export interface InscriptionBackendDTO {
  id: number;
  coursId: number;
  etudiantId: number;
  /** pending | validated | refused */
  status: EnrollmentStatus;
  /** GROUPE | LIBRE */
  source?: "GROUPE" | "LIBRE";
  groupeId?: number | null;
  requestedAt?: string | null;
  decidedAt?: string | null;
}

/** Absence telle que renvoyée par /academic/v1/evaluations/absences (AbsenceResponseDTO). */
export interface AbsenceBackendDTO {
  id?: number;
  seance: string;
  dateAbsence?: string | null;
  justifiee?: boolean;
  etudiantId?: number;
  etudiantNom?: string;
  coursId?: number;
  coursIntitule?: string;
  totalAbsencesCours?: number;
  seuilDepasse?: boolean;
}

/** Note telle que renvoyée par /academic/v1/evaluations/notes/... (NoteResponseDTO = saisie + libellés). */
export interface NoteBackendDTO extends BackendNoteDTO {
  id?: number;
  etudiantNom?: string;
  coursIntitule?: string;
}

/** Informations de cours minimales partagées par BackendCoursDTO (AcademicService) et CoursBackendDTO. */
type CoursInfo = { code?: string | null; intitule?: string } | null | undefined;

/** Indexe une liste de cours backend par identifiant numérique (id absent ignoré). */
const coursParId = <T extends { id?: number }>(cours: T[]): Map<number, T> => {
  const map = new Map<number, T>();
  for (const c of cours) if (typeof c.id === "number") map.set(c.id, c);
  return map;
};

/** Compte étudiant du user-service indexé par id numérique (lecture best-effort : 403/indispo. ignorés). */
const studentAccounts = async (signal?: AbortSignal): Promise<Map<number, { id: string; name: string }>> => {
  const map = new Map<number, { id: string; name: string }>();
  try {
    const res = await api.get<{ items?: Array<{ id: string; firstName: string; lastName: string }> }>("/users?role=student&limit=100", {
      signal,
    });
    for (const u of res.items ?? []) {
      const id = numId(u.id);
      if (id) map.set(id, { id: u.id, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.id });
    }
  } catch {
    // Sans les comptes, les noms affichés sont « Étudiant #id » : l'application continue.
  }
  return map;
};

/** Inscription backend → type Enrollment du front (cours et étudiant enrichis). */
const inscriptionToEnrollment = async (
  dto: InscriptionBackendDTO,
  viewer?: Viewer,
  accounts?: Map<number, { id: string; name: string }>,
): Promise<Enrollment> => {
  let courseCode = `COU-${dto.coursId}`;
  let courseTitle = "Cours";
  try {
    const cours = await AcademicService.getCoursById(dto.coursId);
    courseCode = cours.code?.trim() || courseCode;
    courseTitle = cours.intitule || courseTitle;
  } catch {
    // Cours supprimé ou backend momentanément indisponible : libellés d'appoint.
  }
  const account = accounts?.get(dto.etudiantId);
  const mine = !!viewer && numId(viewer.id) === dto.etudiantId;
  return {
    id: String(dto.id),
    courseId: String(dto.coursId),
    courseCode,
    courseTitle,
    studentId: mine && viewer ? viewer.id : (account?.id ?? String(dto.etudiantId)),
    studentName: mine && viewer ? viewer.name : (account?.name ?? `Étudiant #${dto.etudiantId}`),
    status: dto.status,
    source: dto.source || "LIBRE",
    groupId: dto.groupeId ? String(dto.groupeId) : undefined,
    requestedAt: dto.requestedAt ?? new Date().toISOString(),
    decidedAt: dto.decidedAt ?? undefined,
  };
};

/** Absence backend → type Absence du front (cours et étudiant enrichis). */
const absenceFromDTO = (a: AbsenceBackendDTO, cours: CoursInfo, account?: { id: string; name: string }): Absence => ({
  id: String(a.id ?? `${a.coursId}-${a.etudiantId}-${a.dateAbsence ?? ""}-${a.seance}`),
  studentId: account?.id ?? String(a.etudiantId ?? ""),
  studentName: a.etudiantNom || account?.name || `Étudiant #${a.etudiantId}`,
  courseId: String(a.coursId ?? ""),
  courseCode: cours?.code?.trim() || `COU-${a.coursId}`,
  courseTitle: a.coursIntitule || cours?.intitule || "Cours",
  seance: a.seance,
  dateAbsence: a.dateAbsence ?? "",
  justifiee: a.justifiee ?? false,
});

// ---------- Inscriptions ----------

/** POST /academic/v1/enrollments — 409 si doublon (ALREADY_ENROLLED) ou cours complet (COURSE_FULL). */
export const enroll = async (courseId: string, viewer: Viewer): Promise<Enrollment> => {
  if (!USE_MOCKS) {
    const coursId = numId(courseId);
    if (!coursId) throw new ApiError(400, "Identifiant de cours invalide");
    const dto = await api.post<InscriptionBackendDTO>("/academic/v1/enrollments", { body: { coursId } });
    publishDomainEvent(SERVICE, "InscriptionCréée", `Inscription demandée par ${viewer.name} au cours ${courseId}`);
    return inscriptionToEnrollment(dto, viewer);
  }
  return api.post<Enrollment>("/enrollments", {
    body: { courseId },
    mock: () => {
      svc();
      const course = courseById(courseId);
      const existing = enrollmentFor(courseId, viewer.id);
      if (existing && existing.status !== "refused") {
        throw new ApiError(409, "Vous avez déjà une demande pour ce cours", { code: "ALREADY_ENROLLED", conflicts: [] });
      }
      if (course.enrolled >= course.capacity) {
        throw new ApiError(409, "Ce cours est complet", {
          code: "COURSE_FULL",
          conflicts: [`${course.code} — ${course.enrolled}/${course.capacity} places occupées`],
        });
      }
      const mine = db.enrollments.filter((e) => e.studentId === viewer.id && e.status !== "refused");
      const conflicts: string[] = [];
      for (const e of mine) {
        for (const other of courseById(e.courseId).sessions) {
          for (const mineSession of course.sessions) {
            if (overlaps(mineSession, other)) {
              conflicts.push(
                `${e.courseCode} — ${other.kind} ${other.start}–${other.end} (${other.room}) chevauche ${course.code} ${mineSession.kind} ${mineSession.start}–${mineSession.end}`,
              );
            }
          }
        }
      }
      if (conflicts.length) throw new ApiError(409, "Conflit d'horaire avec vos cours", { code: "SCHEDULE_CONFLICT", conflicts });

      if (existing) db.enrollments.splice(db.enrollments.indexOf(existing), 1); // nouvelle demande après un refus
      const created: Enrollment = {
        id: `e-${++db.seq}`,
        courseId,
        courseCode: course.code,
        courseTitle: course.title,
        studentId: viewer.id,
        studentName: viewer.name,
        status: "pending",
        requestedAt: db.now(),
      };
      db.enrollments.unshift(created);
      return clone(created);
    },
  });
};

/** GET /academic/v1/enrollments — étudiant : les siennes ; enseignant/admin : toutes. */
export const listEnrollments = (viewer: Viewer, signal?: AbortSignal): Promise<Enrollment[]> => {
  if (!USE_MOCKS) {
    return (async () => {
      const etudiantId = viewer.role === "student" ? numId(viewer.id) : undefined;
      const suffix = etudiantId ? `?etudiantId=${etudiantId}` : "";
      const [dtos, accounts] = await Promise.all([
        api.get<InscriptionBackendDTO[]>(`/academic/v1/enrollments${suffix}`, { signal }),
        etudiantId ? Promise.resolve(undefined) : studentAccounts(signal),
      ]);
      const list = await Promise.all(dtos.map((dto) => inscriptionToEnrollment(dto, viewer, accounts)));
      return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    })();
  }
  return api.get<Enrollment[]>("/enrollments", {
    signal,
    mock: () => {
      svc();
      return clone(
        db.enrollments
          .filter((e) => viewer.role === "admin" || viewer.role === "teacher" || e.studentId === viewer.id)
          .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
      );
    },
  });
};

/** PUT /academic/v1/enrollments/{id} (administrateur) — valide ou refuse une demande. */
export const decideEnrollment = async (id: string, status: Exclude<EnrollmentStatus, "pending">, viewer: Viewer): Promise<Enrollment> => {
  if (!USE_MOCKS) {
    if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
    const dto = await api.put<InscriptionBackendDTO>(`/academic/v1/enrollments/${encodeURIComponent(id)}`, {
      body: { status },
    });
    return inscriptionToEnrollment(dto, viewer);
  }
  return api.put<Enrollment>(`/enrollments/${id}/status`, {
    body: { status },
    mock: () => {
      svc();
      if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
      const e = db.enrollments.find((x) => x.id === id);
      if (!e) throw new ApiError(404, "Inscription introuvable");
      if (e.status !== "pending") throw new ApiError(409, "Cette demande a déjà été traitée", { code: "ALREADY_DECIDED", conflicts: [] });
      if (status === "validated") {
        const c = courseById(e.courseId);
        if (c.enrolled >= c.capacity)
          throw new ApiError(409, "Ce cours est complet", {
            code: "COURSE_FULL",
            conflicts: [`${c.code} — ${c.enrolled}/${c.capacity} places occupées`],
          });
        c.enrolled += 1;
      }
      e.status = status;
      e.decidedAt = db.now();
      if (status === "validated") publishDomainEvent(SERVICE, "InscriptionValidée", `${e.studentName} · ${e.courseCode}`);
      return clone(e);
    },
  });
};

// ---------- Emploi du temps (contrat backend : /academic/v1/...) ----------

/** Réponse paginée standard du backend (common/dto/PageResponse.java). */
export interface PageResult<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Séance telle que renvoyée par le backend (SeanceDTO). */
export interface SeanceBackendDTO {
  id: number;
  coursId: number;
  coursCode: string;
  coursIntitule: string;
  groupeId?: number | null;
  groupeNom?: string | null;
  salleId: number;
  salleNom: string;
  enseignantId?: number | null;
  enseignantNom?: string | null;
  type: "CM" | "TD" | "TP";
  /** 1 = lundi ... 6 = samedi. */
  jour: number;
  /** "HH:MM" ( @JsonFormat HH:mm ). */
  heureDebut: string;
  heureFin: string;
}

/** Salle (SalleDTO du backend). */
export interface SalleBackendDTO {
  id: number;
  nom: string;
  batiment?: string | null;
  capacite: number;
}

/** Groupe (GroupeDTO du backend). */
export interface GroupeBackendDTO {
  id: number;
  nom: string;
  type: "CM" | "TD" | "TP";
  coursId: number;
  capacite: number;
  coursCode?: string | null;
  coursIntitule?: string | null;
  effectif?: number | null;
  etudiants?: Array<{ etudiantId: number; nom: string }> | null;
  /** Cours affectés (AffectationDTO du backend). */
  affectations?: Array<{
    coursId: number;
    coursCode?: string | null;
    coursIntitule?: string | null;
    enseignantNom?: string | null;
    type: "CM" | "TD" | "TP";
  }> | null;
}

/** Étudiant (EtudiantDTO du backend : référence micro-service Utilisateur + nom). */
export interface MembreDTO {
  etudiantId: number;
  nom: string;
}

/** Cours (CoursDTO du backend). */
export interface CoursBackendDTO {
  id: number;
  code?: string | null;
  intitule: string;
  departement?: string | null;
  capacite?: number | null;
  nature?: "OBLIGATOIRE" | "OPTIONNEL" | null;
  enseignantId?: number | null;
  enseignantNom?: string | null;
  credits?: number | null;
  semestre?: string | null;
  description?: string | null;
  contenu?: string | null;
  videoTitre?: string | null;
  videoUrl?: string | null;
  videoNomFichier?: string | null;
  videoTaille?: string | null;
  videoFormat?: string | null;
  documentTitre?: string | null;
  documentUrl?: string | null;
  documentNomFichier?: string | null;
  documentTaille?: string | null;
  documentFormat?: string | null;
  /** Liste persistée des supports pédagogiques (DocumentDTO du backend). */
  documents?: Array<{
    id?: number;
    titre?: string | null;
    url?: string | null;
    nomFichier?: string | null;
    taille?: string | null;
    format?: string | null;
  }> | null;
}

const mapSeanceDTO = (s: SeanceBackendDTO): TimetableEntry => ({
  id: String(s.id),
  courseId: String(s.coursId),
  day: s.jour as Day,
  start: s.heureDebut,
  end: s.heureFin,
  room: s.salleNom,
  kind: s.type,
  courseCode: s.coursCode,
  courseTitle: s.coursIntitule,
  teacherName: s.enseignantNom || (s.enseignantId ? `Enseignant #${s.enseignantId}` : ""),
  teacherId: s.enseignantId ? String(s.enseignantId) : undefined,
  groupId: s.groupeId ? String(s.groupeId) : undefined,
  groupName: s.groupeNom ?? undefined,
});

// --- Données de démonstration (mode mock uniquement) ---

/** Salles fictives du mode démo (ids alignés sur le référentiel réel). */
const MOCK_ROOMS: Room[] = [
  { id: "1", nom: "Amphi A", batiment: "Bloc A", capacite: 200 },
  { id: "2", nom: "Amphi B", batiment: "Bloc A", capacite: 150 },
  { id: "3", nom: "B101", batiment: "Bloc B", capacite: 30 },
  { id: "4", nom: "B102", batiment: "Bloc B", capacite: 30 },
  { id: "5", nom: "Labo L1", batiment: "Bloc C", capacite: 20 },
  { id: "6", nom: "Labo L2", batiment: "Bloc C", capacite: 20 },
];

const MOCK_GROUPS: GroupInfo[] = db.courses.slice(0, 3).flatMap((c, i) => [
  { id: String(i * 2 + 1), nom: "G1", kind: "TD" as SessionKind, coursId: c.id, capacite: 25 },
  { id: String(i * 2 + 2), nom: "G2", kind: "TP" as SessionKind, coursId: c.id, capacite: 20 },
]);

/** Store démo : dérivé des cours mock à la première lecture, puis muté par create/delete. */
let mockTimetable: TimetableEntry[] | null = null;
let mockNextId = 1;
const mockTimetableSnapshot = (): TimetableEntry[] => {
  if (mockTimetable === null) {
    mockTimetable = clone(
      db.courses.flatMap((c) =>
        c.sessions.map((s) => ({
          ...s,
          id: String(mockNextId++),
          courseCode: c.code,
          courseTitle: c.title,
          teacherName: c.teacherName,
        })),
      ),
    );
  }
  return mockTimetable;
};

/** Séance démo → DTO backend (pour que le mock respecte le contrat réel). */
const entryToSeanceDTO = (e: TimetableEntry): SeanceBackendDTO => ({
  id: Number(e.id),
  coursId: Number(e.courseId) || 0,
  coursCode: e.courseCode,
  coursIntitule: e.courseTitle,
  groupeId: e.groupId ? Number(e.groupId) : null,
  groupeNom: e.groupName ?? null,
  salleId: Number(MOCK_ROOMS.find((r) => r.nom === e.room)?.id ?? 0),
  salleNom: e.room,
  enseignantId: e.teacherId ? Number(e.teacherId) : null,
  type: e.kind,
  jour: e.day,
  heureDebut: e.start,
  heureFin: e.end,
});

/** GET /academic/v1/sessions — l'emploi du temps vient du backend réel (mock en mode démo). */
export const getTimetable = (viewer: Viewer, signal?: AbortSignal): Promise<TimetableEntry[]> =>
  api
    .get<PageResult<SeanceBackendDTO>>("/academic/v1/sessions?size=100", {
      signal,
      mock: () => {
        svc();
        const visible = mockTimetableSnapshot().filter((e) => {
          if (viewer.role === "admin" || viewer.role === "teacher") return true;
          return db.courses.some((c) => c.id === e.courseId && enrollmentFor(c.id, viewer.id)?.status === "validated");
        });
        const sorted = visible.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
        return {
          content: sorted.map(entryToSeanceDTO),
          page: 0,
          size: 100,
          totalElements: sorted.length,
          totalPages: 1,
        };
      },
    })
    .then((p) => (p?.content?.length ? clone(p.content.map(mapSeanceDTO)) : clone(mockTimetableSnapshot())))
    .catch(() => clone(mockTimetableSnapshot()));

/** POST /academic/v1/sessions — crée une séance ; le backend renvoie 409 en cas de conflit. */
export const createSession = (input: SessionInput) =>
  api.post<TimetableEntry>("/academic/v1/sessions", {
    body: {
      coursId: Number(input.coursId),
      salleId: Number(input.salleId),
      ...(input.groupeId ? { groupeId: Number(input.groupeId) } : {}),
      ...(input.enseignantId ? { enseignantId: Number(input.enseignantId) } : {}),
      type: input.kind,
      jour: input.day,
      heureDebut: input.start,
      heureFin: input.end,
    },
    mock: () => {
      svc();
      const entries = mockTimetableSnapshot();
      const salleNom = MOCK_ROOMS.find((r) => r.id === input.salleId)?.nom ?? "?";
      const conflit = entries.find(
        (e) =>
          e.day === input.day &&
          e.start < input.end &&
          e.end > input.start &&
          (e.room === salleNom || (input.groupeId && e.groupId === input.groupeId)),
      );
      if (conflit) {
        throw new ApiError(
          409,
          `Conflit d'emploi du temps : le jour ${conflit.day} de ${conflit.start} à ${conflit.end} est déjà occupé (salle ${conflit.room}).`,
          { code: "SCHEDULE_CONFLICT" },
        );
      }
      const cours = courseById(input.coursId);
      const entry: TimetableEntry = {
        id: String(mockNextId++),
        courseId: input.coursId,
        day: input.day,
        start: input.start,
        end: input.end,
        room: salleNom,
        kind: input.kind,
        courseCode: cours?.code ?? "",
        courseTitle: cours?.title ?? "",
        teacherName: input.enseignantId ? `Enseignant #${input.enseignantId}` : "",
        teacherId: input.enseignantId,
        groupId: input.groupeId,
        groupName: MOCK_GROUPS.find((g) => g.id === input.groupeId)?.nom,
      };
      mockTimetable = [...entries, entry].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
      return clone(entry);
    },
  });

/** DELETE /academic/v1/sessions/{id} — déplanifie une séance. */
export const deleteSession = (id: string) =>
  api.delete<void>(`/academic/v1/sessions/${id}`, {
    mock: () => {
      svc();
      const entries = mockTimetableSnapshot();
      if (!entries.some((e) => e.id === id)) throw new ApiError(404, "Séance introuvable.");
      mockTimetable = entries.filter((e) => e.id !== id);
    },
  });

/** GET /academic/v1/rooms — salles du référentiel. */
export const listRooms = (signal?: AbortSignal): Promise<Room[]> =>
  api
    .get<PageResult<SalleBackendDTO>>("/academic/v1/rooms?size=100", {
      signal,
      mock: () => {
        svc();
        return {
          content: MOCK_ROOMS.map((r) => ({ id: Number(r.id), nom: r.nom, batiment: r.batiment ?? null, capacite: r.capacite })),
          page: 0,
          size: 100,
          totalElements: MOCK_ROOMS.length,
          totalPages: 1,
        };
      },
    })
    .then((p) =>
      p?.content?.length
        ? p.content.map((s) => ({
            id: String(s.id),
            nom: s.nom,
            batiment: s.batiment ?? undefined,
            capacite: s.capacite,
          }))
        : MOCK_ROOMS,
    )
    .catch(() => MOCK_ROOMS);

/** GET /academic/v1/groups — groupes du référentiel, filtrables par cours. */
export const listGroups = (coursId?: string, signal?: AbortSignal): Promise<GroupInfo[]> =>
  api
    .get<PageResult<GroupeBackendDTO>>(coursId ? `/academic/v1/groups?size=100&coursId=${coursId}` : "/academic/v1/groups?size=100", {
      signal,
      mock: () => {
        svc();
        const content = (coursId ? MOCK_GROUPS.filter((g) => g.coursId === coursId) : MOCK_GROUPS).map((g) => ({
          id: Number(g.id),
          nom: g.nom,
          type: g.kind,
          coursId: Number(g.coursId),
          capacite: g.capacite,
        }));
        return { content, page: 0, size: 100, totalElements: content.length, totalPages: 1 };
      },
    })
    .then((p) =>
      p?.content?.length
        ? p.content.map((g) => ({
            id: String(g.id),
            nom: g.nom,
            kind: g.type,
            coursId: String(g.coursId),
            capacite: g.capacite,
            effectif: g.effectif ?? undefined,
            etudiants: (g.etudiants ?? []).map((e) => ({ etudiantId: String(e.etudiantId), nom: e.nom })),
            affectations: (g.affectations ?? []).map((a) => ({
              coursId: String(a.coursId),
              coursCode: a.coursCode ?? undefined,
              coursIntitule: a.coursIntitule ?? "",
              enseignantNom: a.enseignantNom ?? undefined,
              kind: a.type,
            })),
          }))
        : coursId
          ? MOCK_GROUPS.filter((g) => g.coursId === coursId)
          : MOCK_GROUPS,
    )
    .catch(() => (coursId ? MOCK_GROUPS.filter((g) => g.coursId === coursId) : MOCK_GROUPS));

/** Payload d'un étudiant à inscrire dans une classe. */
export interface EtudiantInput {
  etudiantId: string;
  nom: string;
}

/** POST /academic/v1/groups/{id}/etudiants — 409 si la classe est complète ou l'étudiant déjà membre. */
export const ajouterEtudiant = async (groupeId: string, input: EtudiantInput) => {
  const res = await api.post<MembreDTO>(`/academic/v1/groups/${groupeId}/etudiants`, {
    body: { etudiantId: Number(input.etudiantId), nom: input.nom.trim() },
    mock: () => {
      svc();
      const g = MOCK_GROUPS.find((gr) => gr.id === groupeId);
      if (!g) throw new ApiError(404, "Groupe introuvable.");
      if ((g.etudiants ?? []).some((e) => e.etudiantId === input.etudiantId)) {
        throw new ApiError(409, `L'étudiant fait déjà partie de la classe « ${g.nom} ».`);
      }
      if ((g.etudiants?.length ?? 0) >= g.capacite) {
        throw new ApiError(409, `La classe « ${g.nom} » est complète (${g.capacite} places).`);
      }
      g.etudiants = [...(g.etudiants ?? []), { etudiantId: input.etudiantId, nom: input.nom.trim() }];
      return { etudiantId: Number(input.etudiantId), nom: input.nom.trim() };
    },
  });
  publishDomainEvent(SERVICE, "ÉtudiantAjoutéAuGroupe", `Étudiant ${input.nom} ajouté au groupe #${groupeId}`);
  return res;
};

/** DELETE /academic/v1/groups/{id}/etudiants/{etudiantId} — retrait d'un étudiant (204). */
export const retirerEtudiant = (groupeId: string, etudiantId: string) =>
  api.delete<void>(`/academic/v1/groups/${groupeId}/etudiants/${etudiantId}`, {
    mock: () => {
      svc();
      const g = MOCK_GROUPS.find((gr) => gr.id === groupeId);
      if (!g) throw new ApiError(404, "Groupe introuvable.");
      g.etudiants = (g.etudiants ?? []).filter((e) => e.etudiantId !== etudiantId);
    },
  });

/** Payload d'une affectation de cours à une classe. */
export interface AffectationInput {
  coursId: string;
  kind: SessionKind;
}

/** POST /academic/v1/groups/{id}/cours — affecte un cours (CM/TD/TP) ; 409 si déjà affecté. */
export const affecterCours = async (groupeId: string, input: AffectationInput) => {
  const res = await api.post<AffectationInfo>(`/academic/v1/groups/${groupeId}/cours`, {
    body: { coursId: Number(input.coursId), type: input.kind },
    mock: () => {
      svc();
      const g = MOCK_GROUPS.find((gr) => gr.id === groupeId);
      if (!g) throw new ApiError(404, "Groupe introuvable.");
      if ((g.affectations ?? []).some((a) => a.coursId === input.coursId)) {
        throw new ApiError(409, "Ce cours est déjà affecté à cette classe.");
      }
      const cours = db.courses.find((c) => c.id === input.coursId);
      const nouvelle: AffectationInfo = {
        coursId: input.coursId,
        coursCode: cours?.code ?? undefined,
        coursIntitule: cours?.title ?? "",
        enseignantNom: cours?.teacherName ?? undefined,
        kind: input.kind,
      };
      g.affectations = [...(g.affectations ?? []), nouvelle];
      return nouvelle;
    },
  });
  publishDomainEvent(SERVICE, "CoursAffectéAuGroupe", `Cours #${input.coursId} affecté au groupe #${groupeId} (${input.kind})`);
  return res;
};

/** DELETE /academic/v1/groups/{id}/cours/{coursId} — désaffecte un cours (204). */
export const retirerAffectation = (groupeId: string, coursId: string) =>
  api.delete<void>(`/academic/v1/groups/${groupeId}/cours/${coursId}`, {
    mock: () => {
      svc();
      const g = MOCK_GROUPS.find((gr) => gr.id === groupeId);
      if (!g) throw new ApiError(404, "Groupe introuvable.");
      g.affectations = (g.affectations ?? []).filter((a) => a.coursId !== coursId);
    },
  });

/** Payload de création / modification d'un groupe. */
export interface GroupInput {
  nom: string;
  kind: SessionKind;
  coursId?: string;
  capacite: number;
}

const groupInputToDTO = (input: GroupInput) => ({
  nom: input.nom.trim(),
  type: input.kind,
  ...(input.coursId ? { coursId: Number(input.coursId) } : {}),
  capacite: Number(input.capacite),
});

/** POST /academic/v1/groups — 409 si le nom existe déjà pour ce cours, capacité > cours refusée. */
export const createGroup = (input: GroupInput) =>
  api.post<GroupeBackendDTO>("/academic/v1/groups", {
    body: groupInputToDTO(input),
    mock: () => {
      svc();
      if (MOCK_GROUPS.some((g) => g.coursId === input.coursId && g.nom.toLowerCase() === input.nom.trim().toLowerCase())) {
        throw new ApiError(409, `Un groupe nommé « ${input.nom.trim()} » existe déjà pour ce cours.`);
      }
      const created: GroupInfo = {
        id: String(mockNextId++),
        nom: input.nom.trim(),
        kind: input.kind,
        coursId: input.coursId,
        capacite: input.capacite,
      };
      MOCK_GROUPS.push(created);
      return {
        id: Number(created.id),
        nom: created.nom,
        type: created.kind,
        coursId: Number(created.coursId),
        capacite: created.capacite,
      };
    },
  });

/** PUT /academic/v1/groups/{id} */
export const updateGroup = (id: string, input: GroupInput) =>
  api.put<GroupeBackendDTO>(`/academic/v1/groups/${id}`, {
    body: groupInputToDTO(input),
    mock: () => {
      svc();
      const idx = MOCK_GROUPS.findIndex((g) => g.id === id);
      if (idx === -1) throw new ApiError(404, "Groupe introuvable.");
      if (MOCK_GROUPS.some((g) => g.id !== id && g.coursId === input.coursId && g.nom.toLowerCase() === input.nom.trim().toLowerCase())) {
        throw new ApiError(409, `Un groupe nommé « ${input.nom.trim()} » existe déjà pour ce cours.`);
      }
      MOCK_GROUPS[idx] = { ...MOCK_GROUPS[idx], nom: input.nom.trim(), kind: input.kind, capacite: input.capacite };
      return {
        id: Number(MOCK_GROUPS[idx].id),
        nom: MOCK_GROUPS[idx].nom,
        type: MOCK_GROUPS[idx].kind,
        coursId: Number(MOCK_GROUPS[idx].coursId),
        capacite: MOCK_GROUPS[idx].capacite,
      };
    },
  });

/** DELETE /academic/v1/groups/{id} — 409 si des séances l'utilisent (protégé par le backend). */
export const deleteGroup = (id: string) =>
  api.delete<void>(`/academic/v1/groups/${id}`, {
    mock: () => {
      svc();
      const idx = MOCK_GROUPS.findIndex((g) => g.id === id);
      if (idx === -1) throw new ApiError(404, "Groupe introuvable.");
      if (mockTimetableSnapshot().some((s) => s.groupId === id)) {
        throw new ApiError(409, "Le groupe est utilisé par des séances de l'emploi du temps : déplanifiez-les d'abord.");
      }
      MOCK_GROUPS.splice(idx, 1);
    },
  });

/** GET /academic/v1/courses — liste des cours du backend (contrat réel). */
export const listAcademicCourses = (signal?: AbortSignal): Promise<CoursBackendDTO[]> =>
  api
    .get<CoursBackendDTO[]>("/academic/v1/courses", {
      signal,
      mock: () => {
        svc();
        return db.courses.map((c, i) => ({
          id: i + 1,
          code: c.code,
          intitule: c.title,
          departement: c.department,
          capacite: c.capacity,
          enseignantId: Number(c.teacherId) || null,
          enseignantNom: c.teacherName,
        }));
      },
    })
    .catch(() =>
      db.courses.map((c, i) => ({
        id: i + 1,
        code: c.code,
        intitule: c.title,
        departement: c.department,
        capacite: c.capacity,
        enseignantId: Number(c.teacherId) || null,
        enseignantNom: c.teacherName,
      })),
    );

// ---------- Cours & groupes : contrat réel /academic/v1/... (mode réel uniquement) ----------

const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

/**
 * Les URLs des supports uploadés sont enregistrées en absolu côté backend
 * (ex. http://localhost:8080/uploads/xxx.pptx). Si le port du backend change
 * (8081), elles deviennent injoignables. On réécrit uniquement les URLs locales
 * `/uploads/...` vers l'origine courante de l'API ; les URLs externes et les
 * `blob:` (fichiers locaux) restent inchangés.
 */
const normalizeUploadUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const local = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(parsed.hostname);
    if (local && parsed.pathname.startsWith("/uploads/") && API_ORIGIN) {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // URL relative : servie par le front (public/uploads), on la laisse telle quelle.
  }
  return trimmed;
};

/** CoursBackendDTO → Course du front (sans donnée inventée : sessions fournies par le backend). */
const mapCoursDTOToCourse = (c: CoursBackendDTO, sessions: Session[] = []): Course => {
  const videoResource: ExternalResource | undefined =
    c.videoUrl || c.videoNomFichier
      ? {
          type: "video",
          title: c.videoTitre || "Support vidéo",
          url: normalizeUploadUrl(c.videoUrl),
          fileName: c.videoNomFichier || undefined,
          fileSize: c.videoTaille || undefined,
          format: c.videoFormat || "MP4",
        }
      : undefined;
  const documentResource: ExternalResource | undefined =
    c.documentUrl || c.documentNomFichier
      ? {
          type: "file",
          title: c.documentTitre || "Support de cours",
          url: normalizeUploadUrl(c.documentUrl),
          fileName: c.documentNomFichier || undefined,
          fileSize: c.documentTaille || undefined,
          format: c.documentFormat || "PDF",
        }
      : undefined;

  // Liste persistée des supports pédagogiques (DocumentCours côté backend).
  let documents: ExternalResource[] | undefined = (c.documents ?? [])
    .filter((d) => d.url || d.nomFichier)
    .map((d) => ({
      type: (d.format === "MP4" || d.format === "WEBM" || d.format === "MKV" || d.format === "MOV"
        ? "video"
        : "document") as ExternalResource["type"],
      title: d.titre || d.nomFichier || "Support",
      url: normalizeUploadUrl(d.url),
      fileName: d.nomFichier || undefined,
      fileSize: d.taille || undefined,
      format: d.format || "PDF",
    }));

  // Rétro-compatibilité : un cours sans documents mais avec l'ancien slot document/vidéo.
  if ((!documents || documents.length === 0) && (documentResource || videoResource)) {
    documents = [documentResource, videoResource].filter(Boolean) as ExternalResource[];
  }

  return {
    id: String(c.id),
    code: c.code || "",
    title: c.intitule,
    description: c.description ?? "",
    department: c.departement ?? "",
    semester: (c.semestre as Semester) || "S1",
    credits: c.credits ?? 0,
    teacherId: c.enseignantId ? String(c.enseignantId) : "",
    teacherName: c.enseignantNom || "",
    capacity: c.capacite ?? 0,
    nature: (c.nature as "OBLIGATOIRE" | "OPTIONNEL") || "OBLIGATOIRE",
    enrolled: 0,
    content: c.contenu ?? "",
    videoResource,
    documentResource,
    externalResource: videoResource ?? documentResource,
    documents,
    sessions,
  } as Course;
};

/** SéanceBackendDTO → Session du front. */
const mapSeanceDTOToSession = (s: SeanceBackendDTO): Session => ({
  id: String(s.id),
  courseId: String(s.coursId),
  day: s.jour as Day,
  start: s.heureDebut,
  end: s.heureFin,
  room: s.salleNom,
  kind: s.type,
});

/** Création / modification d'un cours : payload front → corps du CoursDTO backend. */
const coursPayloadToDTO = (payload: Partial<CreateCoursePayload>) => ({
  ...(payload.code !== undefined ? { code: payload.code.toUpperCase().trim() } : {}),
  ...(payload.title !== undefined ? { intitule: payload.title.trim() } : {}),
  ...(payload.department !== undefined ? { departement: payload.department } : {}),
  ...(payload.credits !== undefined ? { credits: Number(payload.credits) } : {}),
  ...(payload.semester !== undefined ? { semestre: payload.semester } : {}),
  ...(payload.teacherId !== undefined ? { enseignantId: Number(payload.teacherId.replace(/\D/g, "")) || null } : {}),
  ...(payload.teacherName !== undefined ? { enseignantNom: payload.teacherName } : {}),
  ...(payload.capacity !== undefined ? { capacite: Number(payload.capacity) } : {}),
  ...(payload.description !== undefined ? { description: payload.description } : {}),
  ...(payload.content !== undefined ? { contenu: payload.content } : {}),
  ...(payload.videoResource
    ? {
        videoTitre: payload.videoResource.title,
        videoUrl: payload.videoResource.url,
        videoNomFichier: payload.videoResource.fileName,
        videoTaille: payload.videoResource.fileSize,
        videoFormat: payload.videoResource.format,
      }
    : {}),
  ...(payload.documentResource
    ? {
        documentTitre: payload.documentResource.title,
        documentUrl: payload.documentResource.url,
        documentNomFichier: payload.documentResource.fileName,
        documentTaille: payload.documentResource.fileSize,
        documentFormat: payload.documentResource.format,
      }
    : {}),
  // Liste complète des supports (PDF, PPTX, DOCX, ZIP, vidéo...) : remplace l'ancienne liste côté backend.
  ...(payload.documents !== undefined
    ? {
        documents: payload.documents.map((d) => ({
          titre: d.title,
          url: d.url ?? null,
          nomFichier: d.fileName ?? null,
          taille: d.fileSize ?? null,
          format: d.format ?? "PDF",
        })),
      }
    : {}),
});

/** Support uploadé côté backend (réponse de POST /academic/v1/files/upload). */
export interface UploadedFileDTO {
  url: string;
  nomFichier: string;
  nomOriginal?: string;
  taille: string;
  format: string;
}

/**
 * POST /academic/v1/files/upload — upload multipart d'un support pédagogique vers le backend.
 * Le fichier est stocké sur disque côté serveur et servi sous /uploads/** :
 * l'URL est donc persistante et accessible depuis n'importe quel navigateur.
 */
export const uploadCourseFile = (file: File) => {
  const body = new FormData();
  body.append("file", file);
  return api.post<UploadedFileDTO>("/academic/v1/files/upload", { body });
};

/** GET /academic/v1/courses + séances associées — uniquement la base de données. */
const fetchRealCourses = (signal?: AbortSignal): Promise<Course[]> =>
  Promise.all([
    api
      .get<CoursBackendDTO[]>("/academic/v1/courses", { signal })
      .catch(() => (AcademicService.getCours() as unknown as Promise<CoursBackendDTO[]>).catch(() => [] as CoursBackendDTO[])),
    api.get<PageResult<SeanceBackendDTO>>("/academic/v1/sessions?size=100", { signal }).catch(() => ({
      content: [] as SeanceBackendDTO[],
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
    })),
  ])
    .then(([cours, seances]) => {
      // Mode réel strict : jamais de cours de démonstration, même si la base est vide.
      if (!cours || !Array.isArray(cours)) {
        return [] as Course[];
      }
      const parCours = new Map<string, Session[]>();
      for (const s of seances?.content ?? []) {
        const key = String(s.coursId);
        const list = parCours.get(key) ?? [];
        list.push(mapSeanceDTOToSession(s));
        parCours.set(key, list);
      }
      return cours.map((c) =>
        mapCoursDTOToCourse(
          c,
          (parCours.get(String(c.id)) ?? []).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
        ),
      );
    })
    .catch(() => [] as Course[]);

/** Filtres du catalogue appliqués côté client (le backend renvoie la liste complète). */
const appliquerFiltres = (courses: Course[], filters: CourseFilters): Course[] => {
  const q = normalize(filters.q?.trim() ?? "");
  const targetTeacherName = filters.teacherName ? normalize(filters.teacherName.trim()) : "";
  return courses.filter((c) => {
    const matchDept = !filters.department || c.department === filters.department;
    const matchQ = !q || normalize(`${c.code} ${c.title} ${c.teacherName}`).includes(q);
    let matchTeacher = true;
    if (filters.teacherId || targetTeacherName) {
      const matchId = Boolean(
        filters.teacherId &&
          (c.teacherId === filters.teacherId ||
            (numId(c.teacherId) && numId(c.teacherId) === numId(filters.teacherId)))
      );
      const matchName = Boolean(
        targetTeacherName &&
          c.teacherName &&
          (normalize(c.teacherName).includes(targetTeacherName) ||
            targetTeacherName.includes(normalize(c.teacherName)))
      );
      matchTeacher = matchId || matchName;
    }
    return matchDept && matchTeacher && matchQ;
  });
};

// ---------- Notes ----------

const gradeKey = (courseId: string, studentId: string) => `${courseId}:${studentId}`;

/** GET /academic/v1/evaluations/notes/etudiant/{id} — notes réelles de l'étudiant, moyenne pondérée par crédits. */
export const getMyGrades = (viewer: Viewer, signal?: AbortSignal): Promise<GradeSummary> => {
  if (!USE_MOCKS) {
    return (async () => {
      const etudiantId = numId(viewer.id);
      const vide: GradeSummary = { items: [], average: null, creditsEarned: 0, creditsTotal: 0 };
      if (!etudiantId) return vide;

      const [notes, coursList, inscriptions] = await Promise.all([
        api.get<NoteBackendDTO[]>(`/academic/v1/evaluations/notes/etudiant/${etudiantId}`, { signal }),
        AcademicService.getCours().catch((): BackendCoursDTO[] => []),
        api
          .get<InscriptionBackendDTO[]>(`/academic/v1/enrollments?etudiantId=${etudiantId}`, { signal })
          .catch(() => [] as InscriptionBackendDTO[]),
      ]);
      const coursById = coursParId(coursList);
      const noteByCours = new Map(notes.filter((n) => n.coursId != null).map((n) => [n.coursId, n]));

      // Les cours inscrits (validés) apparaissent même sans note ; toute note existante reste visible.
      const coursIds = new Set<number>();
      for (const i of inscriptions) if (i.status === "validated") coursIds.add(i.coursId);
      for (const n of notes) if (n.coursId != null) coursIds.add(n.coursId);

      const items = [...coursIds].map((coursId) => {
        const c = coursById.get(coursId);
        const n = noteByCours.get(coursId);
        return {
          courseId: String(coursId),
          code: c?.code?.trim() || `COU-${coursId}`,
          title: c?.intitule || n?.coursIntitule || "Cours",
          credits: c?.credits ?? 0,
          teacherName: c?.enseignantNom || "",
          value: typeof n?.valeur === "number" ? n.valeur : null,
        };
      });
      const graded = items.filter((i) => i.value !== null);
      const weight = graded.reduce((n, i) => n + i.credits, 0);
      const average = weight ? graded.reduce((n, i) => n + i.value! * i.credits, 0) / weight : null;
      return {
        items,
        average,
        creditsEarned: graded.filter((i) => i.value! >= 10).reduce((n, i) => n + i.credits, 0),
        creditsTotal: items.reduce((n, i) => n + i.credits, 0),
      };
    })();
  }
  return api.get<GradeSummary>("/grades/me", {
    signal,
    mock: async () => {
      svc();

      // Synchronisation des notes depuis le backend Spring Boot si disponible
      try {
        const numStudentId = Number(viewer.id.replace(/\D/g, ""));
        if (!isNaN(numStudentId) && numStudentId > 0) {
          const backendNotes = await AcademicService.consulterNotes(numStudentId);
          if (Array.isArray(backendNotes)) {
            for (const n of backendNotes) {
              const matchedCourse = db.courses.find(
                (c) => c.id === `pg-${n.coursId}` || c.id === String(n.coursId) || c.id === `c${n.coursId}`,
              );
              if (matchedCourse) {
                db.grades.set(gradeKey(matchedCourse.id, viewer.id), {
                  value: n.valeur,
                  published: true,
                });
              }
            }
          }
        }
      } catch {
        // Fallback silencieux vers les données locales
      }

      const items = db.enrollments
        .filter((e) => e.studentId === viewer.id && e.status === "validated")
        .map((e) => {
          const c = courseById(e.courseId);
          const g = db.grades.get(gradeKey(c.id, viewer.id));
          return {
            courseId: c.id,
            code: c.code,
            title: c.title,
            credits: c.credits,
            teacherName: c.teacherName,
            value: g?.published ? g.value : null,
          };
        });
      const graded = items.filter((i) => i.value !== null);
      const weight = graded.reduce((n, i) => n + i.credits, 0);
      const average = weight ? graded.reduce((n, i) => n + i.value! * i.credits, 0) / weight : null;
      return {
        items,
        average,
        creditsEarned: graded.filter((i) => i.value! >= 10).reduce((n, i) => n + i.credits, 0),
        creditsTotal: items.reduce((n, i) => n + i.credits, 0),
      };
    },
  });
};

/** GET /academic/v1/evaluations/notes/cours/{id} (enseignant ou administrateur) : notes réelles du cours. */
export const getCourseGrades = (courseId: string, viewer: Viewer, signal?: AbortSignal): Promise<CourseGrades> => {
  if (!USE_MOCKS) {
    return (async () => {
      const coursId = numId(courseId);
      if (!coursId) throw new ApiError(404, "Cours introuvable");
      if (viewer.role === "student") throw new ApiError(403, "Accès interdit à ce cours");

      const [notes, cours, inscriptions, accounts] = await Promise.all([
        api.get<NoteBackendDTO[]>(`/academic/v1/evaluations/notes/cours/${coursId}`, { signal }),
        AcademicService.getCoursById(coursId).catch(() => null),
        api.get<InscriptionBackendDTO[]>(`/academic/v1/enrollments?coursId=${coursId}`, { signal }).catch(() => []),
        studentAccounts(signal),
      ]);

      // Étudiants inscrits (validés) + étudiants ayant déjà une note : l'union.
      const lignes = new Map<number, { studentId: string; studentName: string }>();
      for (const i of inscriptions) {
        if (i.status !== "validated" && !notes.some((n) => n.etudiantId === i.etudiantId)) continue;
        const account = accounts.get(i.etudiantId);
        lignes.set(i.etudiantId, {
          studentId: account?.id ?? String(i.etudiantId),
          studentName: account?.name ?? `Étudiant #${i.etudiantId}`,
        });
      }
      for (const n of notes) {
        if (n.etudiantId != null && !lignes.has(n.etudiantId)) {
          const account = accounts.get(n.etudiantId);
          lignes.set(n.etudiantId, {
            studentId: account?.id ?? String(n.etudiantId),
            studentName: account?.name ?? `Étudiant #${n.etudiantId}`,
          });
        }
      }
      const noteByEtudiant = new Map(notes.filter((n) => n.etudiantId != null).map((n) => [n.etudiantId, n]));
      const entries = [...lignes.values()]
        .map((l) => {
          const note = noteByEtudiant.get(numId(l.studentId) ?? -1);
          return {
            studentId: l.studentId,
            studentName: l.studentName,
            value: typeof note?.valeur === "number" ? note.valeur : null,
            published: note != null,
          };
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName, "fr"));

      return {
        course: {
          id: String(coursId),
          code: cours?.code?.trim() || `COU-${coursId}`,
          title: cours?.intitule || "Cours",
          credits: cours?.credits ?? 0,
        },
        entries,
      };
    })();
  }
  return api.get<CourseGrades>(`/courses/${courseId}/grades`, {
    signal,
    mock: async () => {
      svc();
      const c = courseById(courseId);
      if (viewer.role === "student" || (viewer.role === "teacher" && c.teacherId !== viewer.id && (!viewer.name || !c.teacherName || !normalize(c.teacherName).includes(normalize(viewer.name)))))
        throw new ApiError(403, "Accès interdit à ce cours");

      // Synchronisation des notes depuis PostgreSQL (Spring Boot) pour les étudiants inscrits
      const courseNumId = Number(courseId.replace(/\D/g, "")) || 1;
      const validEnrollments = db.enrollments.filter((e) => e.courseId === courseId && e.status === "validated");

      await Promise.allSettled(
        validEnrollments.map(async (e) => {
          const numStudentId = Number(e.studentId.replace(/\D/g, ""));
          if (!isNaN(numStudentId) && numStudentId > 0) {
            try {
              const backendNotes = await AcademicService.consulterNotes(numStudentId);
              if (Array.isArray(backendNotes)) {
                const matchingNote = backendNotes.find((n) => n.coursId === courseNumId);
                if (matchingNote && typeof matchingNote.valeur === "number") {
                  db.grades.set(gradeKey(courseId, e.studentId), {
                    value: matchingNote.valeur,
                    published: true,
                  });
                }
              }
            } catch {
              // Fallback silencieux vers les données locales
            }
          }
        }),
      );

      const entries = validEnrollments
        .map((e) => {
          const g = db.grades.get(gradeKey(courseId, e.studentId));
          return { studentId: e.studentId, studentName: e.studentName, value: g?.value ?? null, published: g?.published ?? false };
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName, "fr"));
      return clone({ course: { id: c.id, code: c.code, title: c.title, credits: c.credits }, entries });
    },
  });
};

/** GET /academic/v1/evaluations/notes — liste toutes les notes enregistrées en base (tous cours et étudiants). */
export const listAllNotes = async (signal?: AbortSignal): Promise<NoteBackendDTO[]> => {
  if (!USE_MOCKS) {
    try {
      return await api.get<NoteBackendDTO[]>("/academic/v1/evaluations/notes", { signal });
    } catch {
      return [];
    }
  }
  return [];
};

/** PUT /academic/v1/evaluations/notes — enregistre les notes du cours en base (upsert par étudiant/cours). */
export const saveGrades = async (
  courseId: string,
  values: Record<string, number | null>,
  publish: boolean,
  viewer: Viewer,
): Promise<void> => {
  // Sauvegarde locale de secours immédiate pour persistance hors-ligne
  try {
    const stored = JSON.parse(localStorage.getItem("smartcampus.academic.grades") ?? "{}") as Record<string, number | null>;
    for (const [studentId, value] of Object.entries(values)) {
      stored[`${courseId}:${studentId}`] = value;
    }
    localStorage.setItem("smartcampus.academic.grades", JSON.stringify(stored));
  } catch {
    /* ignore */
  }

  if (!USE_MOCKS) {
    if (viewer.role !== "teacher") throw new ApiError(403, "Action réservée uniquement aux enseignants : la saisie des notes est interdite aux administrateurs et étudiants.");
    const coursId = numId(courseId);
    if (!coursId) throw new ApiError(404, "Cours introuvable");
    const enseignantId = numId(viewer.id) ?? 1;
    let count = 0;
    for (const [studentId, value] of Object.entries(values)) {
      if (value !== null && (value < 0 || value > 20)) throw new ApiError(422, "La note doit être comprise entre 0 et 20");
      const etudiantId = numId(studentId);
      if (value === null || !etudiantId) continue;
      await api.post<BackendNoteDTO>("/academic/v1/evaluations/notes", {
        body: { coursId, etudiantId, valeur: value, enseignantId },
      });
      count++;
    }
    if (publish) publishDomainEvent(SERVICE, "NotePubliée", `Cours ${coursId} · ${count} note(s) enregistrée(s)`);
    return;
  }
  await api.put<void>(`/courses/${courseId}/grades`, {
    body: { values, publish },
    mock: async () => {
      svc();
      if (viewer.role !== "teacher") throw new ApiError(403, "Action réservée uniquement aux enseignants : la saisie des notes est interdite aux administrateurs et étudiants.");
      const c = courseById(courseId);
      let count = 0;
      for (const [studentId, value] of Object.entries(values)) {
        if (value !== null && (value < 0 || value > 20)) throw new ApiError(422, "La note doit être comprise entre 0 et 20");
        const prev = db.grades.get(gradeKey(courseId, studentId));
        db.grades.set(gradeKey(courseId, studentId), {
          value,
          published: publish ? value !== null : (prev?.published ?? false) && value === prev?.value,
        });
        if (publish && value !== null) count++;

        // Synchronisation vers Spring Boot si note renseignée
        if (value !== null) {
          const numCourseId = Number(courseId.replace(/\D/g, "")) || 1;
          const numStudentId = Number(studentId.replace(/\D/g, "")) || 1;
          const numTeacherId = Number(viewer.id.replace(/\D/g, "")) || 1;
          try {
            await AcademicService.saisirNote({
              enseignantId: numTeacherId,
              etudiantId: numStudentId,
              coursId: numCourseId,
              valeur: value,
            });
          } catch (e) {
            console.warn("Synchronisation note backend:", e);
          }
        }
      }
      if (publish) publishDomainEvent(SERVICE, "NotePubliée", `${c.code} · ${count} note(s) publiée(s)`);
    },
  });
};

// ---------- Absences ----------

/** GET /academic/v1/evaluations/absences?coursId=&etudiantId= — absences réelles, filtrables. */
export const listAbsences = (filters: AbsenceFilters, viewer: Viewer, signal?: AbortSignal): Promise<Absence[]> => {
  if (!USE_MOCKS) {
    return (async () => {
      const coursId = numId(filters.courseId);
      const etudiantId = numId(filters.studentId);
      const qs = new URLSearchParams();
      if (coursId) qs.set("coursId", String(coursId));
      if (etudiantId) qs.set("etudiantId", String(etudiantId));
      const suffix = qs.size ? `?${qs.toString()}` : "";
      const [absences, coursList, accounts] = await Promise.all([
        api.get<AbsenceBackendDTO[]>(`/academic/v1/evaluations/absences${suffix}`, { signal }),
        AcademicService.getCours().catch((): BackendCoursDTO[] => []),
        viewer.role === "student" ? Promise.resolve(undefined) : studentAccounts(signal),
      ]);
      const coursById = coursParId(coursList);
      let mapped = absences.map((a) => absenceFromDTO(a, coursById.get(a.coursId ?? -1), accounts?.get(a.etudiantId ?? -1)));
      if (coursId) {
        mapped = mapped.filter((a) => numId(a.courseId) === coursId);
      }
      if (etudiantId) {
        mapped = mapped.filter((a) => numId(a.studentId) === etudiantId);
      }
      return mapped;
    })();
  }
  return api.get<Absence[]>("/absences", {
    signal,
    mock: () => {
      svc();
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
        } catch {
          return [] as Absence[];
        }
      })();
      return clone(
        stored.filter(
          (a) => (!filters.courseId || a.courseId === filters.courseId || (numId(filters.courseId) && numId(a.courseId) === numId(filters.courseId))) &&
                 (!filters.studentId || a.studentId === filters.studentId || (numId(filters.studentId) && numId(a.studentId) === numId(filters.studentId))),
        ),
      );
    },
  });
};

export const recordAbsence = (
  data: { courseId: string; studentId: string; studentName: string; seance: string; dateAbsence: string; justifiee: boolean },
  viewer: Viewer,
): Promise<Absence> => {
  if (!USE_MOCKS) {
    return (async () => {
      if (viewer.role !== "teacher") throw new ApiError(403, "Action réservée uniquement aux enseignants");
      const coursId = numId(data.courseId);
      const etudiantId = numId(data.studentId);
      if (!coursId || !etudiantId) throw new ApiError(400, "Identifiant de cours ou d'étudiant invalide");
      const saved = await api.post<AbsenceBackendDTO>("/academic/v1/evaluations/absences", {
        body: {
          coursId,
          etudiantId,
          seance: data.seance,
          dateAbsence: data.dateAbsence || undefined,
          justifiee: data.justifiee,
          enseignantId: numId(viewer.id) ?? 1,
        },
      });
      const cours = await AcademicService.getCoursById(coursId).catch(() => null);
      const account = (await studentAccounts()).get(etudiantId);
      return absenceFromDTO(
        { ...saved, coursId, etudiantId, dateAbsence: saved.dateAbsence ?? data.dateAbsence },
        cours ?? undefined,
        account,
      );
    })();
  }
  return api.post<Absence>("/absences", {
    body: data,
    mock: async () => {
      svc();
      if (viewer.role === "student") throw new ApiError(403, "Action réservée aux enseignants");
      const course = courseById(data.courseId);
      const absence: Absence = {
        id: `abs-${Date.now()}`,
        studentId: data.studentId,
        studentName: data.studentName,
        courseId: data.courseId,
        courseCode: course.code,
        courseTitle: course.title,
        seance: data.seance,
        dateAbsence: data.dateAbsence,
        justifiee: data.justifiee,
      };
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
        } catch {
          return [] as Absence[];
        }
      })();
      stored.unshift(absence);
      localStorage.setItem("smartcampus.academic.absences", JSON.stringify(stored));
      try {
        const courseNumId = Number(data.courseId.replace(/\D/g, "")) || 1;
        const studentNum = Number(data.studentId.replace(/\D/g, "")) || 1;
        await AcademicService.enregistrerAbsence({
          enseignantId: 1,
          etudiantId: studentNum,
          coursId: courseNumId,
          seance: data.seance,
          dateAbsence: data.dateAbsence,
          justifiee: data.justifiee,
        });
      } catch (e) {
        console.warn("Backend absence sync:", e);
      }
      return clone(absence);
    },
  });
};

/** DELETE /academic/v1/evaluations/absences/{id} — supprime définitivement une absence (réservé aux enseignants). */
export const deleteAbsence = async (id: string, viewer: Viewer): Promise<void> => {
  if (viewer.role !== "teacher") throw new ApiError(403, "Action réservée uniquement aux enseignants");
  const numericId = numId(id);
  if (!USE_MOCKS && numericId) {
    try {
      await api.delete<void>(`/academic/v1/evaluations/absences/${numericId}`);
    } catch (e) {
      console.warn("Échec suppression absence backend:", e);
    }
  }
  try {
    const stored = JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
    const filtered = stored.filter((a) => a.id !== id && String(numId(a.id)) !== String(numericId));
    localStorage.setItem("smartcampus.academic.absences", JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
};

/** PUT /academic/v1/evaluations/absences/{id}/justifier?justifiee=true|false — modifie la justification (réservé aux enseignants). */
export const updateAbsenceJustification = async (id: string, justifiee: boolean, viewer: Viewer): Promise<void> => {
  if (viewer.role !== "teacher") throw new ApiError(403, "Action réservée uniquement aux enseignants");
  const numericId = numId(id);
  if (!USE_MOCKS && numericId) {
    try {
      await api.put<AbsenceBackendDTO>(`/academic/v1/evaluations/absences/${numericId}/justifier?justifiee=${justifiee}`);
    } catch (e) {
      console.warn("Échec justification backend:", e);
    }
  }
  try {
    const stored = JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
    const target = stored.find((a) => a.id === id || String(numId(a.id)) === String(numericId));
    if (target) {
      target.justifiee = justifiee;
      localStorage.setItem("smartcampus.academic.absences", JSON.stringify(stored));
    }
  } catch {
    /* ignore */
  }
};

/** GET /academic/v1/evaluations/absences?etudiantId= — absences réelles de l'étudiant connecté. */
export const getMyAbsences = (viewer: Viewer, signal?: AbortSignal): Promise<Absence[]> => {
  if (!USE_MOCKS) {
    return (async () => {
      const etudiantId = numId(viewer.id);
      if (!etudiantId) return [];
      const [absences, coursList] = await Promise.all([
        api.get<AbsenceBackendDTO[]>(`/academic/v1/evaluations/absences?etudiantId=${etudiantId}`, { signal }),
        AcademicService.getCours().catch((): BackendCoursDTO[] => []),
      ]);
      const coursById = coursParId(coursList);
      const mine = { id: viewer.id, name: viewer.name };
      return absences.map((a) => absenceFromDTO(a, coursById.get(a.coursId ?? -1), mine));
    })();
  }
  return api.get<Absence[]>("/absences/me", {
    signal,
    mock: async () => {
      svc();
      let stored: Absence[];
      try {
        stored = JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
      } catch {
        stored = [];
      }

      // Sync depuis backend
      try {
        const numId = Number(viewer.id.replace(/\D/g, ""));
        if (!isNaN(numId) && numId > 0) {
          const backendAbsences = await AcademicService.consulterAbsences(numId);
          if (Array.isArray(backendAbsences)) {
            for (const ba of backendAbsences) {
              const matchedCourse = db.courses.find(
                (c) => c.id === `pg-${ba.coursId}` || c.id === String(ba.coursId) || c.id === `c${ba.coursId}`,
              );
              const exists = stored.some((a) => a.studentId === viewer.id && a.dateAbsence === ba.dateAbsence && a.seance === ba.seance);
              if (!exists) {
                stored.push({
                  id: `abs-be-${ba.id || Date.now()}`,
                  studentId: viewer.id,
                  studentName: viewer.name,
                  courseId: matchedCourse?.id || String(ba.coursId),
                  courseCode: matchedCourse?.code || `COU-${ba.coursId}`,
                  courseTitle: matchedCourse?.title || "Cours",
                  seance: ba.seance || "CM",
                  dateAbsence: ba.dateAbsence || new Date().toISOString().split("T")[0],
                  justifiee: ba.justifiee ?? false,
                });
              }
            }
            localStorage.setItem("smartcampus.academic.absences", JSON.stringify(stored));
          }
        }
      } catch {
        // Fallback local
      }

      return clone(stored.filter((a) => a.studentId === viewer.id));
    },
  });
};

// ---------- Sessions / Emploi du temps (admin/enseignant) ----------

export const addSession = (courseId: string, session: Omit<Session, "id" | "courseId">, viewer: Viewer) =>
  api.post<Session>(`/courses/${courseId}/sessions`, {
    body: session,
    mock: () => {
      svc();
      if (viewer.role === "student") throw new ApiError(403, "Accès interdit");
      const course = courseById(courseId);
      const newSession: Session = { id: `s-${Date.now()}`, courseId, ...session };
      course.sessions.push(newSession);
      saveStoredCourses(db.courses);
      return clone(newSession);
    },
  });

export const removeSession = (courseId: string, sessionId: string, viewer: Viewer) =>
  api.delete<{ success: boolean }>(`/courses/${courseId}/sessions/${sessionId}`, {
    mock: () => {
      svc();
      if (viewer.role === "student") throw new ApiError(403, "Accès interdit");
      const course = courseById(courseId);
      const idx = course.sessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        course.sessions.splice(idx, 1);
        saveStoredCourses(db.courses);
      }
      return { success: true };
    },
  });

// ---------- Affectation Enseignant & Outils Backend Spécifiques ----------

/** PUT /courses/{id}/teacher — Affecte un enseignant à un cours via Spring Boot (PUT /cours/{id}/enseignant/{enseignantId}) */
export const assignTeacher = (courseId: string, teacherId: string, teacherName: string, viewer: Viewer) =>
  api.put<Course>(`/courses/${courseId}/teacher`, {
    body: { teacherId, teacherName },
    mock: async () => {
      svc();
      if (viewer.role !== "admin") throw new ApiError(403, "Réservé à l'administrateur");
      const course = courseById(courseId);
      course.teacherId = teacherId;
      course.teacherName = teacherName;
      saveStoredCourses(db.courses);

      const cleanCourseId = Number(courseId.replace(/\D/g, ""));
      const cleanTeacherId = Number(teacherId.replace(/\D/g, ""));
      if (!isNaN(cleanCourseId) && cleanCourseId > 0 && !isNaN(cleanTeacherId) && cleanTeacherId > 0) {
        try {
          await AcademicService.affecterEnseignant(cleanCourseId, cleanTeacherId);
        } catch (e) {
          console.warn("Backend affectation enseignant:", e);
        }
      }
      return clone(course);
    },
  });

/** GET /students/{id}/average — Calcule la moyenne de l'étudiant via Spring Boot (GET /evaluations/notes/etudiant/{id}/moyenne) */
export const calculateStudentAverage = (studentId: string) =>
  api.get<{ etudiantId: number; moyenne: number }>(`/students/${studentId}/average`, {
    mock: async () => {
      const numId = Number(studentId.replace(/\D/g, "")) || 1;
      try {
        return await AcademicService.calculerMoyenne(numId);
      } catch {
        const enrollments = db.enrollments.filter((e) => e.studentId === studentId && e.status === "validated");
        let total = 0,
          count = 0;
        enrollments.forEach((e) => {
          const g = db.grades.get(`${e.courseId}:${studentId}`);
          if (g?.published && g.value !== null) {
            total += g.value;
            count++;
          }
        });
        return { etudiantId: numId, moyenne: count > 0 ? total / count : 0 };
      }
    },
  });

/** Vérifie l'état de santé du service backend Spring Boot */
export const checkBackendHealth = async (): Promise<boolean> => {
  return AcademicService.checkHealth();
};

/** Récupère un cours directement depuis PostgreSQL par son ID numérique */
export const getBackendCourseById = async (id: string) => {
  const numId = Number(id.replace(/\D/g, ""));
  if (isNaN(numId) || numId <= 0) return null;
  try {
    return await AcademicService.getCoursById(numId);
  } catch {
    return null;
  }
};
