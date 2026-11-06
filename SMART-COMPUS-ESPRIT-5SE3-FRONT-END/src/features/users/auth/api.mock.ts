import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { fakeJwt } from "@/shared/auth/jwt";
import { byEmail, logLogin, registerAccount, svc } from "../api";
import { db, DEMO_CODE, DEMO_PASSWORD } from "../mocks";
import { fullName, type LoginResult, type RegisterInput, type UserAccount } from "../types";
import { MAX_ATTEMPTS } from "../utils/validation";

/**
 * Stubs d'authentification du user-service.
 * 401 identifiants invalides · 403 compte inactif · 423 compte verrouillé · 409 e-mail existant (registerAccount).
 */

/** POST /auth/login */
export const login = (email: string, password: string) =>
  api.post<LoginResult>("/auth/login", {
    body: { email, password },
    mock: () => {
      svc();
      const acct = byEmail(email);
      if (!acct) throw new ApiError(401, "Identifiants invalides", { code: "INVALID_CREDENTIALS" });
      if (acct.status === "suspended") {
        logLogin(acct, false);
        throw new ApiError(423, "Compte suspendu", { code: "ACCOUNT_LOCKED", failedAttempts: acct.failedAttempts, max: MAX_ATTEMPTS });
      }
      if (acct.status === "inactive") throw new ApiError(403, "Compte désactivé", { code: "ACCOUNT_INACTIVE" });

      if (password !== (db.passwords.get(acct.email) ?? DEMO_PASSWORD)) {
        acct.failedAttempts += 1;
        logLogin(acct, false);
        if (acct.failedAttempts >= MAX_ATTEMPTS) {
          acct.status = "suspended";
          throw new ApiError(423, "Compte suspendu", { code: "ACCOUNT_LOCKED", failedAttempts: acct.failedAttempts, max: MAX_ATTEMPTS });
        }
        throw new ApiError(401, "Identifiants invalides", {
          code: "INVALID_CREDENTIALS",
          failedAttempts: acct.failedAttempts,
          max: MAX_ATTEMPTS,
        });
      }
      acct.failedAttempts = 0;
      acct.lastLoginAt = db.now();
      logLogin(acct, true);
      const user = {
        id: acct.id,
        name: fullName(acct),
        email: acct.email,
        role: acct.role,
        avatarUrl: acct.avatarUrl,
        mustChangePassword: acct.mustChangePassword,
      };
      return { token: fakeJwt(user), user };
    },
  });

/** POST /auth/register — inscription publique : toujours un compte étudiant (le rôle du formulaire est ignoré). */
export const register = (input: RegisterInput): Promise<UserAccount> => registerAccount(input);

/** POST /auth/forgot-password — répond toujours OK (ne révèle pas l'existence du compte). */
export const forgotPassword = (email: string) =>
  api.post<{ ok: true }>("/auth/forgot-password", {
    body: { email },
    mock: () => {
      svc();
      return { ok: true };
    },
  });

/** POST /auth/reset-password */
export const resetPassword = (email: string, token: string, password: string) =>
  api.post<{ ok: true }>("/auth/reset-password", {
    body: { email, token, password },
    mock: () => {
      svc();
      const acct = byEmail(email);
      if (!acct || token.length < 6) throw new ApiError(400, "Lien de réinitialisation invalide ou expiré");
      db.passwords.set(acct.email, password);
      return { ok: true };
    },
  });

/** POST /auth/verify-email — code à 6 chiffres (démo : DEMO_CODE). */
export const verifyEmail = (email: string, code: string) =>
  api.post<{ ok: true }>("/auth/verify-email", {
    body: { email, code },
    mock: () => {
      svc();
      if (code !== DEMO_CODE) throw new ApiError(400, "Code invalide ou expiré", { code: "INVALID_CODE" });
      return { ok: true };
    },
  });

/** POST /auth/resend-activation */
export const resendActivation = (email: string) =>
  api.post<{ ok: true }>("/auth/resend-activation", {
    body: { email },
    mock: () => {
      svc();
      return { ok: true };
    },
  });
