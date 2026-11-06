import type { MessageKey } from "@/shared/i18n/fr";
import { EMAIL_DOMAIN } from "@/shared/config/env";

export const ROLES = ["student", "teacher", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, MessageKey> = {
  student: "role.student",
  teacher: "role.teacher",
  admin: "role.admin",
};

export interface User {
  id: string; // matricule
  name: string;
  email: string;
  role: Role;
  /** Photo de profil (URL ou data URL). */
  avatarUrl?: string;
  /** Vrai tant que l'utilisateur utilise le mot de passe temporaire reçu par e-mail. */
  mustChangePassword?: boolean;
}

/** Utilisateurs fictifs : un par rôle, utilisés par le sélecteur de rôle de démo. */
export const DEMO_USERS: Record<Role, User> = {
  student: { id: "ETU-2024-0187", name: "Yasmine Ben Salah", email: "yasmine.bensalah@" + EMAIL_DOMAIN, role: "student" },
  teacher: { id: "ENS-0042", name: "Karim Trabelsi", email: "karim.trabelsi@" + EMAIL_DOMAIN, role: "teacher" },
  admin: { id: "ADM-0001", name: "Sonia Gharbi", email: "sonia.gharbi@" + EMAIL_DOMAIN, role: "admin" },
};
