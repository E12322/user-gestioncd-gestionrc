import { lazy } from "react";
import { Home } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const housingModule: ModuleDef = {
  id: "housing",
  path: "/residences",
  icon: Home,
  labelKey: "module.housing",
  shortLabelKey: "module.housing.short",
  roles: ["student", "admin"],
  tone: "green",
  Page: lazy(() => import("./pages/HousingModule")),
};
