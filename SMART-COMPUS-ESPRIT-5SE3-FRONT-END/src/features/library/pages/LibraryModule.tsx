import { Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "@/shared/auth/roles";
import { useAuth } from "@/shared/auth/AuthContext";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import BookDetailPage from "./BookDetailPage";
import CatalogPage from "./CatalogPage";
import LoansAdminPage from "./LoansAdminPage";
import MyLoansPage from "./MyLoansPage";

const TABS: { to: string; key: string; end?: boolean; roles: readonly Role[] }[] = [
  { to: "/bibliotheque", key: "lib.tab.catalog", end: true, roles: ["student", "teacher", "admin"] },
  { to: "/bibliotheque/mes-prets", key: "lib.tab.loans", roles: ["student", "teacher", "admin"] },
  { to: "/bibliotheque/gestion", key: "lib.tab.admin", roles: ["admin"] },
];

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium",
    isActive ? "border-navy text-navy" : "border-transparent text-slate-600 hover:text-foreground",
  );

/** Module Bibliothèque : catalogue, mes prêts, gestion des prêts et des ouvrages (administrateur). */
export default function LibraryModule() {
  const t = useT();
  const { role } = useAuth();
  const allowed = (roles: readonly Role[]) => roles.includes(role);
  return (
    <>
      <PageHeader title={t("module.library")} description={t("lib.module.description")} />
      <nav aria-label={t("lib.module.nav")} className="mb-6 flex overflow-x-auto border-b">
        {TABS.filter((x) => allowed(x.roles)).map((x) => (
          <NavLink key={x.to} to={x.to} end={x.end} className={tab}>
            {t(x.key)}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<CatalogPage />} />
          <Route path="livres/:id" element={<BookDetailPage />} />
          <Route path="mes-prets" element={<MyLoansPage />} />
          <Route path="gestion" element={allowed(["admin"]) ? <LoansAdminPage /> : <ForbiddenView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </Suspense>
    </>
  );
}
