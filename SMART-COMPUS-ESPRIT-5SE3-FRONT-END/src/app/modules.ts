import { usersModule } from "@/features/users";
import { academicModule } from "@/features/academic";
import { resourcesModule } from "@/features/resources";
import { housingModule } from "@/features/housing";
import { studentLifeModule } from "@/features/student-life";
import { libraryModule } from "@/features/library";
import type { Role } from "@/shared/auth/roles";
import { canAccess } from "@/shared/modules/ModulesContext";
import type { ModuleDef } from "@/shared/types/module";

/** Ordre = ordre d'affichage dans la barre latérale. */
export const MODULES: readonly ModuleDef[] = [
  usersModule,
  academicModule,
  resourcesModule,
  housingModule,
  studentLifeModule,
  libraryModule,
];

export { canAccess };
export const modulesForRole = (role: Role) => MODULES.filter((m) => canAccess(m, role));
