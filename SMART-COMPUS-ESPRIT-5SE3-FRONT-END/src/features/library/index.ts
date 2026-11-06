import { lazy } from "react";
import { Library } from "lucide-react";
import type { ModuleDef } from "@/shared/types/module";
import "./i18n";

export const libraryModule: ModuleDef = {
  id: "library",
  path: "/bibliotheque",
  icon: Library,
  labelKey: "module.library",
  shortLabelKey: "module.library.short",
  roles: ["student", "teacher", "admin"],
  tone: "navy",
  Page: lazy(() => import("./pages/LibraryModule")),
};
