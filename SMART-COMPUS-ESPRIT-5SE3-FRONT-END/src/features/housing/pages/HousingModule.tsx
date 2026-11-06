import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import MaintenancePage from "./MaintenancePage";
import MyRequestPage from "./MyRequestPage";
import RequestsPage from "./RequestsPage";
import ResidencesPage from "./ResidencesPage";

const TABS: { to: string; key: string; end?: boolean; roles: readonly Role[] }[] = [
  { to: "/residences", key: "housing.tab.residences", end: true, roles: ["student", "admin"] },
  { to: "/residences/ma-demande", key: "housing.tab.mine", roles: ["student"] },
  { to: "/residences/demandes", key: "housing.tab.requests", roles: ["admin"] },
  { to: "/residences/maintenance", key: "housing.tab.maintenance", roles: ["student", "admin"] },
];

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Résidences : résidences, ma demande (étudiant), file des demandes (admin), maintenance. */
export default function HousingModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);
  return (
    <>
      <PageHeader title={t("module.housing")} description={t("housing.module.description")} />
      <nav aria-label={t("housing.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {TABS.filter((x) => allowed(x.roles)).map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
            {t(x.key)}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ResidencesPage />} />
          <Route path="ma-demande" element={allowed(["student"]) ? <MyRequestPage /> : <ForbiddenView />} />
          <Route path="demandes" element={allowed(["admin"]) ? <RequestsPage /> : <ForbiddenView />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
