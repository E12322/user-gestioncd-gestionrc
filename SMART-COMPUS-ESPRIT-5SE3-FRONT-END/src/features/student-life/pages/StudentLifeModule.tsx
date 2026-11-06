import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import ClubAdminPage from "./ClubAdminPage";
import ClubDetailPage from "./ClubDetailPage";
import ClubsPage from "./ClubsPage";
import EventsPage from "./EventsPage";

const TABS: { to: string; key: string; end?: boolean; roles: readonly Role[] }[] = [
  { to: "/vie-etudiante", key: "life.tab.clubs", end: true, roles: ["student", "teacher", "admin"] },
  { to: "/vie-etudiante/agenda", key: "life.tab.events", roles: ["student", "teacher", "admin"] },
  { to: "/vie-etudiante/gestion", key: "life.tab.admin", roles: ["admin"] },
];

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Vie étudiante & clubs : annuaire, agenda, gestion (administrateur). */
export default function StudentLifeModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);
  return (
    <>
      <PageHeader title={t("module.student-life")} description={t("life.module.description")} />
      <nav aria-label={t("life.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {TABS.filter((x) => allowed(x.roles)).map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
            {t(x.key)}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ClubsPage />} />
          <Route path="clubs/:id" element={<ClubDetailPage />} />
          <Route path="agenda" element={<EventsPage />} />
          <Route path="gestion" element={allowed(["admin"]) ? <ClubAdminPage /> : <ForbiddenView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
