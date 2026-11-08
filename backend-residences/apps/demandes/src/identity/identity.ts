/**
 * Identite transmise par la passerelle (en-tetes X-User-Id / X-Role),
 * etablie a partir de la verification du JWT. Absente lors des appels
 * internes de confiance ou des tests : les regles d'acces ne s'appliquent alors pas.
 */
export interface Identity {
  userId: string;
  role: string;
}
