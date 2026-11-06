import { lazy } from "react";
import { Users } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const usersModule: ModuleDef = {
  id: "users",
  path: "/utilisateurs",
  icon: Users,
  labelKey: "module.users",
  shortLabelKey: "module.users.short",
  roles: ["admin"],
  tone: "navy",
  Page: lazy(() => import("./pages/UsersModule")),
};

/** API publique du module Utilisateurs : seul point d'entrée autorisé pour les autres couches. */
export { AuthProvider } from "./auth/AuthProvider";
export * from "./routes";
