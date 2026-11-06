/**
 * Génération locale du plan de cours (syllabus + chapitres).
 *
 * Aucun appel réseau : le backend académique n'expose pas encore d'endpoint IA.
 * Le service produit un plan structuré et déterministe à partir de l'intitulé,
 * du niveau et du nombre d'exercices demandés, puis la fiche cours l'enregistre
 * via `updateCourse` (le contenu est donc bien persisté côté backend).
 */

export interface ChapitreGenere {
  titre: string;
  dureeEstimee: string;
  contenu: string;
}

export interface CoursGenere {
  objectifs: string[];
  chapitres: ChapitreGenere[];
}

export interface GenererCoursInput {
  /** Matière / intitulé du cours. */
  matiere: string;
  /** Niveau visé (ex. « Avancé (M2/Ingénieur) »). */
  niveau?: string;
  /** Nombre d'exercices proposés dans le dernier chapitre. */
  nbExercices?: number;
}

const DELAI_SIMULE_MS = 600;

export class AiAcademicService {
  /**
   * Génère un plan de cours complet (objectifs + chapitres).
   * Signature compatible avec l'appel de la fiche cours.
   */
  static async genererCoursComplet(input: GenererCoursInput): Promise<CoursGenere> {
    const matiere = input.matiere?.trim() || "le cours";
    const niveau = input.niveau?.trim() || "Licence";
    const nbExercices = Math.max(1, Math.min(input.nbExercices ?? 3, 10));

    // Petit délai pour refléter une génération (et laisser l'UI afficher son état).
    await new Promise((resolve) => setTimeout(resolve, DELAI_SIMULE_MS));

    return {
      objectifs: [
        `Maîtriser les notions fondamentales de ${matiere}.`,
        `Appliquer les méthodes de ${matiere} à des situations concrètes.`,
        `Analyser et résoudre des problèmes de niveau ${niveau}.`,
        `Communiquer les résultats avec rigueur et esprit critique.`,
      ],
      chapitres: [
        {
          titre: "Introduction et notions clés",
          dureeEstimee: "1 semaine",
          contenu:
            `Présentation de ${matiere}, de son vocabulaire et de ses objectifs. ` +
            `Mise en contexte, panorama des domaines d'application et rappels nécessaires ` +
            `pour aborder le reste du programme.`,
        },
        {
          titre: "Fondements théoriques",
          dureeEstimee: "2 semaines",
          contenu:
            `Étude des principes et des modèles qui structurent ${matiere}. ` +
            `Démonstrations guidées, propriétés essentielles et limites des approches étudiées.`,
        },
        {
          titre: "Méthodes et mise en pratique",
          dureeEstimee: "2 semaines",
          contenu:
            `Application des concepts à des cas réels : démarche pas à pas, choix des outils ` +
            `et interprétation des résultats. Travaux dirigés et retours d'expérience.`,
        },
        {
          titre: "Approfondissement et évaluation",
          dureeEstimee: "1 semaine",
          contenu:
            `Synthèse du cours, ouverture vers ${niveau} et préparation à l'évaluation. ` +
            `${nbExercices} exercice${nbExercices > 1 ? "s" : ""} d'application ` +
            `${nbExercices > 1 ? "sont proposés" : "est proposé"} avec correction commentée.`,
        },
      ],
    };
  }
}
