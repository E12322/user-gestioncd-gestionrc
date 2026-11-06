import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/shared/auth/roles";
import type { MessageKey } from "@/shared/i18n/fr";

export type ModuleId = "users" | "academic" | "resources" | "housing" | "student-life" | "library";

/**
 * Contrat d'un module. Pour ajouter un module, il suffit de :
 *  1. remplir son dossier `features/<id>/` (pages, types, mock, hooks) ;
 *  2. remplacer `Page` dans son `index.ts` par ses vraies routes (sous-routes via `/*`).
 * Le registre, la navigation, les droits d'accès et la gestion d'erreur s'adaptent seuls.
 */
export interface ModuleDef {
  id: ModuleId;
  /** Chemin racine, ex. "/bibliotheque" */
  path: string;
  icon: LucideIcon;
  labelKey: MessageKey;
  shortLabelKey: MessageKey;
  /** Rôles autorisés à voir et ouvrir le module. */
  roles: readonly Role[];
  /** Couleur d'accent (classes Tailwind) pour les cartes d'accès rapide. */
  tone: "navy" | "blue" | "amber" | "green" | "red";
  /** Composant routé sur `${path}/*` (chargé à la demande). */
  Page: LazyExoticComponent<ComponentType> | ComponentType;
}
