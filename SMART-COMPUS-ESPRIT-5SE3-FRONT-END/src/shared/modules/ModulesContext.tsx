import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Role } from "@/shared/auth/roles";
import type { ModuleDef, ModuleId } from "@/shared/types/module";

/** Droit d'accès d'un rôle à un module (fonction pure). */
export const canAccess = (module: ModuleDef, role: Role) => module.roles.includes(role);

export interface ModuleRegistry {
  modules: readonly ModuleDef[];
  getModule: (id: ModuleId) => ModuleDef;
  modulesForRole: (role: Role) => ModuleDef[];
}

const ModulesContext = createContext<ModuleRegistry | null>(null);

/**
 * Le registre des modules est assemblé par la couche `app` (la seule qui connaît tous les modules),
 * puis exposé ici : les pages et composants partagés le lisent sans jamais importer `app`.
 */
export function ModulesProvider({ modules, children }: { modules: readonly ModuleDef[]; children: ReactNode }) {
  const value = useMemo<ModuleRegistry>(
    () => ({
      modules,
      getModule: (id) => {
        const found = modules.find((m) => m.id === id);
        if (!found) throw new Error(`Module inconnu : ${id}`);
        return found;
      },
      modulesForRole: (role) => modules.filter((m) => canAccess(m, role)),
    }),
    [modules],
  );
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModuleRegistry {
  const ctx = useContext(ModulesContext);
  if (!ctx) throw new Error("useModules doit être utilisé dans <ModulesProvider>");
  return ctx;
}
