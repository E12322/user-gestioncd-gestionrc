import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import ApprovalsPage from "./ApprovalsPage";
import ReservationRequestPage from "./ReservationRequestPage";
import ReservationsPage from "./ReservationsPage";
import RoomsPage from "./RoomsPage";

const TABS: { to: string; key: string; end?: boolean; roles: readonly Role[] }[] = [
  { to: "/ressources", key: "resources.tab.rooms", end: true, roles: ["teacher", "admin"] },
  { to: "/ressources/mes-reservations", key: "resources.tab.mine", roles: ["teacher", "admin"] },
  { to: "/ressources/reserver", key: "resources.tab.request", roles: ["teacher", "admin"] },
  { to: "/ressources/validations", key: "resources.tab.approvals", roles: ["admin"] },
];

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Ressources : salles, mes réservations, nouvelle demande, validations (admin). */
export default function ResourcesModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);
  return (
    <>
      <PageHeader title={t("module.resources")} description={t("resources.module.description")} />
      <nav aria-label={t("resources.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {TABS.filter((x) => allowed(x.roles)).map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
            {t(x.key)}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<RoomsPage />} />
          <Route path="mes-reservations" element={<ReservationsPage />} />
          <Route path="reserver" element={<ReservationRequestPage />} />
          <Route path="validations" element={allowed(["admin"]) ? <ApprovalsPage /> : <ForbiddenView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
