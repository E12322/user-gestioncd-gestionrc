import { lazy } from "react";

/** Pages du module exposées en dehors de /utilisateurs (routes publiques et profil), branchées dans App.tsx. */
export const LoginPage = lazy(() => import("./auth/pages/LoginPage"));
export const RegisterPage = lazy(() => import("./auth/pages/RegisterPage"));
export const ForgotPasswordPage = lazy(() => import("./auth/pages/ForgotPasswordPage"));
export const ResetPasswordPage = lazy(() => import("./auth/pages/ResetPasswordPage"));
export const ProfilePage = lazy(() => import("./pages/ProfilePage"));
export const ChangePasswordPage = lazy(() => import("./auth/pages/ChangePasswordPage"));
export const VerifyEmailPage = lazy(() => import("./auth/pages/VerifyEmailPage"));
