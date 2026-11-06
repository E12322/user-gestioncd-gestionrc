import { createContext, useContext } from "react";
import type { Role, User } from "./roles";

/**
 * Contrat de session partagé par toute l'application.
 * Il vit dans `shared` pour que chaque module puisse lire la session sans dépendre du module Utilisateurs :
 * c'est le module Utilisateurs qui fournit l'implémentation (`AuthProvider`), branchée par la couche `app`.
 */
export interface AuthValue {
  /** Utilisateur courant (profil étudiant de démonstration tant qu'aucune session n'existe). */
  user: User;
  role: Role;
  isAuthenticated: boolean;
  /** Ouvre une session (après POST /auth/login). */
  login: (user: User, token?: string) => void;
  /** Sélecteur de rôle de démo : ouvre une session avec l'utilisateur fictif du rôle. */
  setRole: (role: Role) => void;
  updateUser: (patch: Partial<Pick<User, "name" | "email" | "avatarUrl" | "mustChangePassword">>) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
