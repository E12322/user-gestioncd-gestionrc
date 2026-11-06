import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";
import { MODULES, canAccess } from "@/app/modules";
import { ForbiddenView, NotFoundView } from "@/shared/components/common/ErrorViews";
import { ModuleBoundary } from "@/shared/components/common/ModuleBoundary";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAuth } from "@/shared/auth/AuthContext";
import type { ModuleDef } from "@/shared/types/module";
import {
  ChangePasswordPage,
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "@/features/users";
import { ProtectedRoute } from "./ProtectedRoute";
import { ROUTES } from "./routes";

const DashboardPage = lazy(() => import("@/pages/DashboardPage/DashboardPage"));
const ShowcasePage = lazy(() => import("@/pages/ShowcasePage/ShowcasePage"));
const ConflictDemoPage = lazy(() => import("@/pages/ConflictDemoPage/ConflictDemoPage"));

/** Garde de rôle : 403 « Accès refusé » si le rôle courant n'a pas accès au module. */
function ModuleRoute({ module }: { module: ModuleDef }) {
  const { role } = useAuth();
  if (!canAccess(module, role)) return <ForbiddenView />;
  return <ModuleBoundary module={module} />;
}

/** Table de routage : pages publiques, puis tout ce qui exige une session (coque + modules). */
export function AppRouter() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-40" />}>
      <Routes>
        {/* Pages publiques (module Utilisateurs) */}
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.changePassword} element={<ChangePasswordPage />} />
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path={ROUTES.profile.slice(1)} element={<ProfilePage />} />
            {MODULES.map((m) => (
              <Route key={m.id} path={`${m.path}/*`} element={<ModuleRoute module={m} />} />
            ))}
            <Route path="demo/403" element={<ForbiddenView />} />
            <Route path="demo/409" element={<ConflictDemoPage />} />
            <Route path="demo/composants" element={<ShowcasePage />} />
            <Route path="*" element={<NotFoundView />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
