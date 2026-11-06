import { lazy } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "./routes";
import { useAuth } from "@/shared/auth/AuthContext";

const LandingPage = lazy(() => import("@/pages/LandingPage/LandingPage"));

/**
 * Sans session : « / » affiche la page d'accueil publique, toute autre page redirige vers /connexion.
 * Avec session : « / » reste le tableau de bord.
 */
export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    if (location.pathname === ROUTES.home) return <LandingPage />;
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }
  // Mot de passe temporaire : rien d'autre n'est accessible tant que l'utilisateur n'a pas choisi le sien.
  if (user.mustChangePassword && location.pathname !== ROUTES.changePassword) return <Navigate to={ROUTES.changePassword} replace />;
  return <Outlet />;
}
