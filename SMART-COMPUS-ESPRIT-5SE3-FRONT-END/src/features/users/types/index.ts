import type { Role } from "@/shared/auth/roles";

export type AccountStatus = "active" | "inactive" | "suspended";

/** Compte utilisateur géré par le user-service. `id` = matricule. */
export interface UserAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  status: AccountStatus;
  /** Échecs de connexion consécutifs ; le compte est suspendu à MAX_ATTEMPTS. */
  failedAttempts: number;
  createdAt: string;
  lastLoginAt: string | null;
  /** Photo de profil (URL ; data URL en mode démo). */
  avatarUrl?: string;
  /** Mot de passe temporaire envoyé par e-mail : à changer à la première connexion. */
  mustChangePassword?: boolean;
}

export const fullName = (u: Pick<UserAccount, "firstName" | "lastName">) => `${u.firstName} ${u.lastName}`;

export interface UserFilters {
  q?: string;
  role?: Role | "";
  status?: AccountStatus | "";
}

export interface UserList {
  items: UserAccount[];
  stats: { total: number; active: number; inactive: number; suspended: number };
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  password: string;
}

/** Création d'un compte par un administrateur : le mot de passe temporaire est généré par le service et envoyé par e-mail. */
export interface AdminCreateInput {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

export interface AdminCreateResult {
  account: UserAccount;
  /** Démo uniquement : sans serveur de messagerie, le mot de passe temporaire est affiché à l'administrateur. */
  demoTemporaryPassword?: string;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginResult {
  /** Mode mock uniquement : avec le vrai user-service, les jetons sont dans des cookies httpOnly (absents du corps). */
  token?: string;
  user: { id: string; name: string; email: string; role: Role; avatarUrl?: string; mustChangePassword?: boolean };
}

export interface LoginEvent {
  id: string;
  userId: string;
  userName: string;
  date: string;
  ip: string;
  device: string;
  success: boolean;
}

export interface LoginHistoryFilters {
  userId?: string;
  result?: "success" | "failure" | "";
}

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export interface PermissionMatrix {
  permissions: PermissionDef[];
  /** matrix[role][permissionKey] */
  matrix: Record<Role, Record<string, boolean>>;
}

/** Événements de domaine publiés par le user-service. */
export type DomainEvent = "UtilisateurCréé" | "RôleModifié";
