import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import CoursesPage from "./CoursesPage";
import CourseDetailPage from "./CourseDetailPage";
import EnrollmentsPage from "./EnrollmentsPage";
import GradesPage from "./GradesPage";
import EmploiDuTempsPage from "./EmploiDuTempsPage";
import PlanningAssistePage from "./TimetablePage";
import AbsencesPage from "./AbsencesPage";
import AcademicResultsPage from "./AcademicResultsPage";
import GroupsPage from "./GroupsPage";
import PilotagePage from "./PilotagePage";

const TABS: { to: string; label: string; end?: boolean; roles: readonly Role[] }[] = [
  { to: "/academique", label: "Cours", end: true, roles: ["student", "teacher", "admin"] },
  { to: "/academique/groupes", label: "Groupes", roles: ["admin"] },
  { to: "/academique/emploi-du-temps", label: "Emploi du temps", roles: ["student", "teacher", "admin"] },
  { to: "/academique/planification", label: "Planification assistée", roles: ["admin"] },
  { to: "/academique/notes", label: "Notes", roles: ["student", "teacher", "admin"] },
  { to: "/academique/absences", label: "Absences", roles: ["student", "teacher", "admin"] },
  { to: "/academique/inscriptions", label: "Inscriptions", roles: ["student", "admin"] },
  { to: "/academique/resultats", label: "Résultats", roles: ["student", "teacher", "admin"] },
  { to: "/academique/pilotage", label: "Pilotage & Statistiques", roles: ["admin"] },
];

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",

    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
    isActive ? "border-navy text-navy font-semibold" : "border-transparent text-slate-600 hover:border-slate-300 hover:text-foreground",
  );

/** Module Académique : catalogue des cours, groupes, emploi du temps, notes, absences, inscriptions, résultats. */
export default function AcademicModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);

  return (
    <>
      <PageHeader title={t("module.academic")} description={t("academic.module.description")} />
      <nav aria-label={t("academic.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {TABS.filter((x) => allowed(x.roles)).map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
            {x.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<CoursesPage />} />
          <Route path="cours/:id" element={<CourseDetailPage />} />
          <Route path="groupes" element={allowed(["admin"]) ? <GroupsPage /> : <ForbiddenView />} />
          <Route path="emploi-du-temps" element={<EmploiDuTempsPage />} />
          <Route path="planification" element={allowed(["admin"]) ? <PlanningAssistePage /> : <ForbiddenView />} />
          <Route path="notes" element={<GradesPage />} />
          <Route path="absences" element={<AbsencesPage />} />
          <Route path="inscriptions" element={allowed(["student", "admin"]) ? <EnrollmentsPage /> : <ForbiddenView />} />
          <Route path="resultats" element={allowed(["student", "teacher", "admin"]) ? <AcademicResultsPage /> : <ForbiddenView />} />
          <Route path="pilotage" element={allowed(["admin"]) ? <PilotagePage /> : <ForbiddenView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
