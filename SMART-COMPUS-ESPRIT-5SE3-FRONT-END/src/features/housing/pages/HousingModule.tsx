import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import ChambresPage from "./ChambresPage";
import ContratsPage from "./ContratsPage";
import DemandesPage from "./DemandesPage";
import MaintenancePage from "./MaintenancePage";
import NewDemandePage from "./NewDemandePage";
import ResidencesPage from "./ResidencesPage";

interface Tab {
  to: string;
  key: string;
  end?: boolean;
  roles: readonly Role[];
}

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Résidences : vue d'ensemble, chambres, demandes (étudiant/admin), contrats, maintenance. */
export default function HousingModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);

  const tabs: Tab[] = [
    { to: "/residences", key: "housing.tab.overview", end: true, roles: ["student", "admin"] },
    { to: "/residences/chambres", key: "housing.tab.rooms", roles: ["student", "admin"] },
    { to: "/residences/demandes", key: role === "admin" ? "housing.tab.requests" : "housing.tab.myrequests", roles: ["student", "admin"] },
    { to: "/residences/contrats", key: "housing.tab.contracts", roles: ["student", "admin"] },
    { to: "/residences/maintenance", key: "housing.tab.maintenance", roles: ["student", "admin"] },
  ];

  return (
    <>
      <PageHeader title={t("module.housing")} description={t("housing.module.description")} />
      <nav aria-label={t("housing.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {tabs
          .filter((x) => allowed(x.roles))
          .map((x) => (
            <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
              {t(x.key)}
            </NavLink>
          ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ResidencesPage />} />
          <Route path="chambres" element={<ChambresPage />} />
          <Route path="demandes" element={<DemandesPage />} />
          <Route path="demandes/new" element={allowed(["student"]) ? <NewDemandePage /> : <ForbiddenView />} />
          <Route path="contrats" element={<ContratsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
