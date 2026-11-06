import { API_BASE_URL } from "@/shared/api/client";

/**
 * Client de communication directe avec le backend Spring Boot (microservice gestionetudiant).
 *
 * L'URL du serveur est dérivée de VITE_API_BASE_URL (ex. http://localhost:8081/api -> http://localhost:8081),
 * donc une seule variable à changer dans le .env si le port ou l'hôte évolue.
 *
 * Chemins actuels du backend :
 *  - /cours/...            (CoursController)
 *  - /evaluations/...      (EvaluationController)
 *  - /planifications/...   (PlanificationController)
 * Les contrôleurs ayant aussi une route /api/academic/v1/..., on pourra migrer plus tard sans toucher aux pages.
 */
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export interface BackendCoursDTO {
  id?: number;
  code?: string;
  intitule: string;
  departement?: string;
  credits?: number;
  semestre?: string;
  enseignantId?: number | null;
  enseignantNom?: string | null;
  capacite?: number;
  description?: string;
  contenu?: string;

  // Support Vidéo
  videoTitre?: string;
  videoUrl?: string;
  videoNomFichier?: string;
  videoTaille?: string;
  videoFormat?: string;

  // Support Document PDF
  documentTitre?: string;
  documentUrl?: string;
  documentNomFichier?: string;
  documentTaille?: string;
  documentFormat?: string;

  emploiDuTempsId?: number | null;
}

export interface BackendNoteDTO {
  enseignantId: number;
  etudiantId: number;
  coursId: number;
  valeur: number;
}

export interface BackendAbsenceDTO {
  /** Identifiant technique renvoyé par le backend (absent sur un DTO de saisie). */
  id?: number;
  enseignantId: number;
  etudiantId: number;
  coursId: number;
  seance: string;
  dateAbsence?: string;
  justifiee?: boolean;
}

/**
 * Emploi du temps (PlanificationController, /planifications).
 * Les champs métier doivent reprendre ceux de EmploiDuTempsDTO côté Java ;
 * la signature d'index permet de transmettre ceux qui ne sont pas listés ici.
 */
export interface BackendEmploiDuTempsDTO {
  id?: number;
  utilisateurId?: number | null;
  [champ: string]: unknown;
}

interface HttpOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Message d'erreur affiché si le backend répond autre chose que 2xx. */
  errorMessage: string;
  signal?: AbortSignal;
}

/**
 * Appel HTTP unique vers le backend académique :
 * - envoie les cookies de session (credentials) et l'en-tête de mode d'authentification,
 *   ce qui prépare le passage futur à Spring Security sans modifier les pages ;
 * - transforme les erreurs réseau et HTTP en Error avec un message lisible ;
 * - gère les réponses sans corps (204, 200 vide).
 */
async function http<T>(path: string, opts: HttpOptions): Promise<T> {
  const { method = "GET", body, errorMessage, signal } = opts;

  let response: Response;
  try {
    response = await fetch(`${BACKEND_BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-Auth-Mode": "cookie",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error(`Backend académique injoignable (${BACKEND_BASE_URL}). Vérifiez que Spring Boot est démarré.`, {
      cause: e,
    });
  }

  if (!response.ok) {
    throw new Error(`Erreur backend (${response.status}): ${errorMessage}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export class AcademicService {
  /**
   * Vérifie si le backend Spring Boot est opérationnel.
   */
  static async checkHealth(): Promise<boolean> {
    try {
      await http<unknown>("/cours/getAll", {
        errorMessage: "Backend indisponible",
        signal: AbortSignal.timeout(2500),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ───────────── Cours ─────────────

  /**
   * Enregistre un cours complet dans PostgreSQL (POST /cours/create)
   */
  static async creerCours(
    payloadOrTitle: Partial<BackendCoursDTO> | string,
    enseignantId?: number | null,
    enseignantNom?: string | null,
  ): Promise<BackendCoursDTO> {
    const body: BackendCoursDTO =
      typeof payloadOrTitle === "string"
        ? {
            intitule: payloadOrTitle,
            enseignantId: enseignantId ?? 1,
            enseignantNom: enseignantNom ?? "Enseignant ESPRIT",
          }
        : {
            code: payloadOrTitle.code,
            intitule: payloadOrTitle.intitule || "",
            departement: payloadOrTitle.departement,
            credits: payloadOrTitle.credits ?? 3,
            semestre: payloadOrTitle.semestre ?? "S1",
            enseignantId: payloadOrTitle.enseignantId ?? enseignantId ?? 1,
            enseignantNom: payloadOrTitle.enseignantNom ?? enseignantNom ?? "Enseignant ESPRIT",
            capacite: payloadOrTitle.capacite ?? 40,
            description: payloadOrTitle.description,
            contenu: payloadOrTitle.contenu,
            videoTitre: payloadOrTitle.videoTitre,
            videoUrl: payloadOrTitle.videoUrl,
            videoNomFichier: payloadOrTitle.videoNomFichier,
            videoTaille: payloadOrTitle.videoTaille,
            videoFormat: payloadOrTitle.videoFormat,
            documentTitre: payloadOrTitle.documentTitre,
            documentUrl: payloadOrTitle.documentUrl,
            documentNomFichier: payloadOrTitle.documentNomFichier,
            documentTaille: payloadOrTitle.documentTaille,
            documentFormat: payloadOrTitle.documentFormat,
            emploiDuTempsId: payloadOrTitle.emploiDuTempsId,
          };

    return http<BackendCoursDTO>("/cours/create", {
      method: "POST",
      body,
      errorMessage: "Impossible de créer le cours en base de données",
    });
  }

  /**
   * Récupère la liste intégrale des cours (GET /cours/getAll)
   */
  static async getCours(): Promise<BackendCoursDTO[]> {
    return http<BackendCoursDTO[]>("/cours/getAll", {
      errorMessage: "Impossible de récupérer les cours",
    });
  }

  /**
   * Consulte un cours par son ID (GET /cours/{id})
   */
  static async getCoursById(id: number | string): Promise<BackendCoursDTO> {
    return http<BackendCoursDTO>(`/cours/${encodeURIComponent(String(id))}`, {
      errorMessage: `Impossible de trouver le cours ${id}`,
    });
  }

  /**
   * Met à jour un cours dans PostgreSQL (PUT /cours/update/{id})
   */
  static async modifierCours(
    id: number | string,
    payloadOrTitle: Partial<BackendCoursDTO> | string,
    enseignantId?: number | null,
  ): Promise<BackendCoursDTO> {
    const body: BackendCoursDTO =
      typeof payloadOrTitle === "string"
        ? {
            id: Number(id),
            intitule: payloadOrTitle,
            enseignantId: enseignantId ?? 1,
          }
        : {
            intitule: "",
            ...payloadOrTitle,
            id: Number(id),
          };

    return http<BackendCoursDTO>(`/cours/update/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      body,
      errorMessage: "Impossible de mettre à jour le cours",
    });
  }

  /**
   * Supprime un cours de la base PostgreSQL (DELETE /cours/delete/{id})
   */
  static async supprimerCours(id: number | string): Promise<void> {
    await http<void>(`/cours/delete/${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      errorMessage: "Impossible de supprimer le cours",
    });
  }

  /**
   * Affecte un enseignant à un cours (PUT /cours/{id}/enseignant/{enseignantId})
   */
  static async affecterEnseignant(id: number | string, enseignantId: number | string): Promise<BackendCoursDTO> {
    return http<BackendCoursDTO>(`/cours/${encodeURIComponent(String(id))}/enseignant/${encodeURIComponent(String(enseignantId))}`, {
      method: "PUT",
      errorMessage: "Impossible d'affecter l'enseignant",
    });
  }

  // ───────────── Évaluations ─────────────

  /**
   * Saisit une note pour un étudiant (POST /evaluations/notes)
   */
  static async saisirNote(data: BackendNoteDTO): Promise<BackendNoteDTO> {
    return http<BackendNoteDTO>("/evaluations/notes", {
      method: "POST",
      body: data,
      errorMessage: "Impossible d'enregistrer la note",
    });
  }

  /**
   * Modifie une note (PUT /evaluations/notes/{id}?valeur=...&enseignantId=...)
   */
  static async modifierNote(id: number | string, valeur: number, enseignantId: number): Promise<BackendNoteDTO> {
    const query = `?valeur=${encodeURIComponent(String(valeur))}&enseignantId=${encodeURIComponent(String(enseignantId))}`;
    return http<BackendNoteDTO>(`/evaluations/notes/${encodeURIComponent(String(id))}${query}`, {
      method: "PUT",
      errorMessage: "Impossible de modifier la note",
    });
  }

  /**
   * Récupère les notes d'un étudiant (GET /evaluations/notes/etudiant/{etudiantId})
   */
  static async consulterNotes(etudiantId: number | string): Promise<BackendNoteDTO[]> {
    return http<BackendNoteDTO[]>(`/evaluations/notes/etudiant/${encodeURIComponent(String(etudiantId))}`, {
      errorMessage: "Impossible de consulter les notes",
    });
  }

  /**
   * Calcule la moyenne générale d'un étudiant (GET /evaluations/notes/etudiant/{etudiantId}/moyenne)
   */
  static async calculerMoyenne(etudiantId: number | string): Promise<{ etudiantId: number; moyenne: number }> {
    return http<{ etudiantId: number; moyenne: number }>(`/evaluations/notes/etudiant/${encodeURIComponent(String(etudiantId))}/moyenne`, {
      errorMessage: "Impossible de calculer la moyenne",
    });
  }

  /**
   * Enregistre une absence (POST /evaluations/absences)
   */
  static async enregistrerAbsence(data: BackendAbsenceDTO): Promise<BackendAbsenceDTO> {
    return http<BackendAbsenceDTO>("/evaluations/absences", {
      method: "POST",
      body: data,
      errorMessage: "Impossible d'enregistrer l'absence",
    });
  }

  /**
   * Récupère les absences d'un étudiant (GET /evaluations/absences/etudiant/{etudiantId})
   */
  static async consulterAbsences(etudiantId: number | string): Promise<BackendAbsenceDTO[]> {
    return http<BackendAbsenceDTO[]>(`/evaluations/absences/etudiant/${encodeURIComponent(String(etudiantId))}`, {
      errorMessage: "Impossible de consulter les absences",
    });
  }

  // ───────────── Planification (emplois du temps) ─────────────

  /**
   * Crée un emploi du temps (POST /planifications/emplois-du-temps, réponse 201)
   */
  static async creerEmploiDuTemps(dto: BackendEmploiDuTempsDTO): Promise<BackendEmploiDuTempsDTO> {
    return http<BackendEmploiDuTempsDTO>("/planifications/emplois-du-temps", {
      method: "POST",
      body: dto,
      errorMessage: "Impossible de créer l'emploi du temps",
    });
  }

  /**
   * Liste les emplois du temps, filtrés par utilisateur si utilisateurId est fourni
   * (GET /planifications/emplois-du-temps?utilisateurId=...)
   */
  static async consulterEmploiDuTemps(utilisateurId?: number | string): Promise<BackendEmploiDuTempsDTO[]> {
    const query =
      utilisateurId !== undefined && utilisateurId !== null && utilisateurId !== ""
        ? `?utilisateurId=${encodeURIComponent(String(utilisateurId))}`
        : "";

    return http<BackendEmploiDuTempsDTO[]>(`/planifications/emplois-du-temps${query}`, {
      errorMessage: "Impossible de consulter les emplois du temps",
    });
  }

  /**
   * Consulte un emploi du temps par son ID (GET /planifications/emplois-du-temps/{id})
   */
  static async consulterEmploiDuTempsParId(id: number | string): Promise<BackendEmploiDuTempsDTO> {
    return http<BackendEmploiDuTempsDTO>(`/planifications/emplois-du-temps/${encodeURIComponent(String(id))}`, {
      errorMessage: `Impossible de trouver l'emploi du temps ${id}`,
    });
  }

  /**
   * Associe un cours à un emploi du temps
   * (POST /planifications/emplois-du-temps/{id}/cours/{coursId}, réponse 200 sans corps)
   */
  static async associerCoursAEmploiDuTemps(id: number | string, coursId: number | string): Promise<void> {
    await http<void>(`/planifications/emplois-du-temps/${encodeURIComponent(String(id))}/cours/${encodeURIComponent(String(coursId))}`, {
      method: "POST",
      errorMessage: `Impossible d'associer le cours ${coursId} à l'emploi du temps ${id}`,
    });
  }
}
