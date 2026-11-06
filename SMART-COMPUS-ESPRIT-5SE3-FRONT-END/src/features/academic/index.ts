import { lazy } from "react";
import { BookOpen } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const academicModule: ModuleDef = {
  id: "academic",
  path: "/academique",
  icon: BookOpen,
  labelKey: "module.academic",
  shortLabelKey: "module.academic.short",
  roles: ["student", "teacher", "admin"],
  tone: "blue",
  Page: lazy(() => import("./pages/AcademicModule")),
};
