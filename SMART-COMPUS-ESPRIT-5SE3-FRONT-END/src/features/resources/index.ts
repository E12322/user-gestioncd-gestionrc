import { lazy } from "react";
import { Building2 } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const resourcesModule: ModuleDef = {
  id: "resources",
  path: "/ressources",
  icon: Building2,
  labelKey: "module.resources",
  shortLabelKey: "module.resources.short",
  roles: ["teacher", "admin"],
  tone: "amber",
  Page: lazy(() => import("./pages/ResourcesModule")),
};
