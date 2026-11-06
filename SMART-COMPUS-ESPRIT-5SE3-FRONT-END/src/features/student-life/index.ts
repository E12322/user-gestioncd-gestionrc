import { lazy } from "react";
import { Drama } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const studentLifeModule: ModuleDef = {
  id: "student-life",
  path: "/vie-etudiante",
  icon: Drama,
  labelKey: "module.student-life",
  shortLabelKey: "module.student-life.short",
  roles: ["student", "teacher", "admin"],
  tone: "red",
  Page: lazy(() => import("./pages/StudentLifeModule")),
};
