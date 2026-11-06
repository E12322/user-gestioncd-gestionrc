import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { NotFoundView } from "@/shared/components/common/ErrorViews";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import UsersListPage from "./UsersListPage";
import RolesMatrixPage from "./RolesMatrixPage";
import LoginHistoryPage from "./LoginHistoryPage";

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Utilisateurs (administrateur) : comptes, rôles et permissions, historique de connexion. */
export default function UsersModule() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("module.users")} description={t("users.module.description")} />
      <nav aria-label={t("users.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        <NavLink to="/utilisateurs" end className={tab}>
          {t("users.tab.accounts")}
        </NavLink>
        <NavLink to="/utilisateurs/roles" className={tab}>
          {t("users.tab.roles")}
        </NavLink>
        <NavLink to="/utilisateurs/historique" className={tab}>
          {t("users.tab.history")}
        </NavLink>
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<UsersListPage />} />
          <Route path="roles" element={<RolesMatrixPage />} />
          <Route path="historique" element={<LoginHistoryPage />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
