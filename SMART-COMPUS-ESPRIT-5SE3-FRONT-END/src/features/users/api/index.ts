import { toast } from "sonner";
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/errors";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { fr } from "@/shared/i18n/fr";
import { normalize } from "@/shared/lib/format";
import { assertAvailable } from "@/shared/services/serviceHealth";
import { db, DEMO_PASSWORD, PERMISSIONS, saveAvatar } from "../mocks";
import { generateTemporaryPassword, INSTITUTIONAL_DOMAIN, isInstitutionalEmail, passwordError } from "../utils/validation";
import {
  fullName,
  type AccountStatus,
  type AdminCreateInput,
  type AdminCreateResult,
  type DomainEvent,
  type LoginEvent,
  type LoginHistoryFilters,
  type PermissionMatrix,
  type ProfileInput,
  type RegisterInput,
  type UserAccount,
  type UserFilters,
  type UserList,
} from "../types";

/**
 * Stubs du user-service (via l'API Gateway). En mode mock, chaque appel est résolu par la
 * fonction `mock` sur la base en mémoire `db`. Les codes d'erreur suivent le contrat prévu :
 * 401 identifiants invalides, 403 compte inactif, 404 introuvable, 409 e-mail existant, 423 compte verrouillé.
 */

const clone = <T>(x: T): T => structuredClone(x);
export const svc = () => assertAvailable("users");
const roleLabel = (r: Role) => fr[ROLE_LABEL[r]];
export const byEmail = (email: string) => db.users.find((u) => u.email === email.trim().toLowerCase());

function byId(id: string) {
  const u = db.users.find((x) => x.id === id);
  if (!u) throw new ApiError(404, "Utilisateur introuvable");
  return u;
}

/** Événement de domaine publié sur le bus (Kafka/RabbitMQ en production) — affiché en toast en démo. */
export function publishEvent(name: DomainEvent, description: string) {
  console.info(`[user-service] événement publié : ${name}`, description);
  toast.success(`Événement publié : ${name}`, { description });
}

export function logLogin(u: UserAccount, success: boolean) {
  db.history.unshift({
    id: `h-${++db.seq}`,
    userId: u.id,
    userName: fullName(u),
    date: db.now(),
    ip: "41.226.12.87",
    device: `${navigator.userAgent.includes("Firefox") ? "Firefox" : "Chrome"} · ${navigator.platform || "Navigateur"}`,
    success,
  });
}

const ID_PREFIX: Record<Role, string> = { student: "ETU", teacher: "ENS", admin: "ADM" };

// ---------- Utilisateurs ----------

/**
 * POST /auth/register (public) — auto-inscription d'un étudiant. Le rôle n'est jamais fourni par le client : le service
 * crée toujours un compte « student ». Une adresse e-mail = un compte (409 sinon). Publie UtilisateurCréé.
 */
export const registerAccount = (input: Omit<RegisterInput, "role">) =>
  api.post<UserAccount>("/auth/register", {
    body: { firstName: input.firstName, lastName: input.lastName, email: input.email, password: input.password },
    mock: () => {
      svc();
      const email = input.email.trim().toLowerCase();
      if (!isInstitutionalEmail(email)) throw new ApiError(422, `Adresse @${INSTITUTIONAL_DOMAIN} requise`);
      if (byEmail(email)) throw new ApiError(409, "Un compte existe déjà avec cette adresse", { code: "EMAIL_EXISTS" });
      const acct: UserAccount = {
        id: `${ID_PREFIX.student}-${new Date().getFullYear()}-${String(++db.seq).padStart(4, "0")}`,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        role: "student",
        status: "active",
        failedAttempts: 0,
        createdAt: db.now(),
        lastLoginAt: null,
      };
      db.users.unshift(acct);
      db.passwords.set(email, input.password);
      publishEvent("UtilisateurCréé", `${fullName(acct)} (${roleLabel(acct.role)}) · ${acct.id}`);
      return clone(acct);
    },
  });

/**
 * POST /users (administrateur) — crée le compte avec un mot de passe temporaire généré par le service et envoyé par e-mail.
 * Le compte est marqué « à changer » : au premier accès, l'utilisateur doit choisir son propre mot de passe.
 * En mode démo (pas de messagerie), le mot de passe temporaire est renvoyé pour être affiché à l'administrateur.
 */
export const createUserByAdmin = (input: AdminCreateInput) =>
  api.post<AdminCreateResult>("/users", {
    body: input,
    mock: () => {
      svc();
      const email = input.email.trim().toLowerCase();
      if (!isInstitutionalEmail(email)) throw new ApiError(422, `Adresse @${INSTITUTIONAL_DOMAIN} requise`);
      if (byEmail(email)) throw new ApiError(409, "Un compte existe déjà avec cette adresse", { code: "EMAIL_EXISTS" });
      const temporary = generateTemporaryPassword();
      const acct: UserAccount = {
        id: `${ID_PREFIX[input.role]}-${new Date().getFullYear()}-${String(++db.seq).padStart(4, "0")}`,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        role: input.role,
        status: "active",
        failedAttempts: 0,
        createdAt: db.now(),
        lastLoginAt: null,
        mustChangePassword: true,
      };
      db.users.unshift(acct);
      db.passwords.set(email, temporary);
      publishEvent("UtilisateurCréé", `${fullName(acct)} (${roleLabel(acct.role)}) · ${acct.id}`);
      return { account: clone(acct), demoTemporaryPassword: temporary };
    },
  });

/** Construit une query string en ignorant les valeurs vides. */
const query = (params: Record<string, string | undefined>) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `?${qs}` : "";
};

/** GET /users?q=&role=&status= */
export const listUsers = (filters: UserFilters, signal?: AbortSignal) =>
  api.get<UserList>(`/users${query({ q: filters.q?.trim(), role: filters.role, status: filters.status })}`, {
    signal,
    mock: () => {
      svc();
      const q = normalize(filters.q?.trim() ?? "");
      const items = db.users.filter(
        (u) =>
          (!filters.role || u.role === filters.role) &&
          (!filters.status || u.status === filters.status) &&
          (!q || normalize(`${fullName(u)} ${u.email} ${u.id}`).includes(q)),
      );
      const count = (s: AccountStatus) => db.users.filter((u) => u.status === s).length;
      return clone({
        items,
        stats: { total: db.users.length, active: count("active"), inactive: count("inactive"), suspended: count("suspended") },
      });
    },
  });

/** GET /users/{id} */
export const getUser = (id: string, signal?: AbortSignal) =>
  api.get<UserAccount>(`/users/${id}`, {
    signal,
    mock: () => {
      svc();
      return clone(byId(id));
    },
  });

/** PUT /users/{id} (profil) */
export const updateProfile = (id: string, input: ProfileInput) =>
  api.put<UserAccount>(`/users/${id}`, {
    body: input,
    mock: () => {
      svc();
      const u = byId(id);
      Object.assign(u, { firstName: input.firstName.trim(), lastName: input.lastName.trim(), phone: input.phone?.trim() || undefined });
      return clone(u);
    },
  });

/** PUT /users/{id}/password — change le mot de passe : 401 si l'actuel est faux, 422 si le nouveau est faible ou identique. */
export const changePassword = (id: string, current: string, next: string) =>
  api.put<{ ok: true }>(`/users/${id}/password`, {
    body: { current, next },
    mock: () => {
      svc();
      const u = byId(id);
      if (current !== (db.passwords.get(u.email) ?? DEMO_PASSWORD))
        throw new ApiError(401, "Mot de passe actuel incorrect", { code: "WRONG_PASSWORD" });
      if (next === current) throw new ApiError(422, "Le nouveau mot de passe doit être différent de l'actuel", { code: "SAME_PASSWORD" });
      if (passwordError(next)) throw new ApiError(422, "Mot de passe trop faible", { code: "WEAK_PASSWORD" });
      db.passwords.set(u.email, next);
      u.mustChangePassword = false;
      return { ok: true };
    },
  });

/** PUT /users/{id}/avatar — enregistre la photo de profil (`avatarUrl` = null pour la supprimer). */
export const updateAvatar = (id: string, avatarUrl: string | null) =>
  api.put<UserAccount>(`/users/${id}/avatar`, {
    body: { avatarUrl },
    mock: () => {
      svc();
      const u = byId(id);
      if (avatarUrl) u.avatarUrl = avatarUrl;
      else delete u.avatarUrl;
      saveAvatar(id, avatarUrl ?? undefined);
      return clone(u);
    },
  });

/** PUT /users/{id}/role — publie RôleModifié. */
export const changeRole = (id: string, role: Role) =>
  api.put<UserAccount>(`/users/${id}/role`, {
    body: { role },
    mock: () => {
      svc();
      const u = byId(id);
      const previous = u.role;
      u.role = role;
      publishEvent("RôleModifié", `${fullName(u)} : ${roleLabel(previous)} → ${roleLabel(role)}`);
      return clone(u);
    },
  });

/** PATCH /users/{id}/status — activer (réinitialise le compteur d'échecs) ou désactiver. */
export const setStatus = (id: string, status: Exclude<AccountStatus, "suspended">) =>
  api.patch<UserAccount>(`/users/${id}/status`, {
    body: { status },
    mock: () => {
      svc();
      const u = byId(id);
      u.status = status;
      if (status === "active") u.failedAttempts = 0;
      return clone(u);
    },
  });

/** DELETE /users/{id} */
export const deleteUser = (id: string) =>
  api.delete<void>(`/users/${id}`, {
    mock: () => {
      svc();
      const u = byId(id);
      db.users.splice(db.users.indexOf(u), 1);
      db.passwords.delete(u.email);
    },
  });

// ---------- Rôles & permissions ----------

/** GET /roles/permissions */
export const getPermissions = (signal?: AbortSignal) =>
  api.get<PermissionMatrix>("/roles/permissions", {
    signal,
    mock: () => {
      svc();
      return clone({ permissions: PERMISSIONS, matrix: db.permissions });
    },
  });

/** PUT /roles/permissions */
export const setPermission = (role: Role, key: string, granted: boolean) =>
  api.put<void>("/roles/permissions", {
    body: { role, key, granted },
    mock: () => {
      svc();
      if (role === "admin" && key.startsWith("users."))
        throw new ApiError(403, "Les droits d'administration des utilisateurs sont verrouillés");
      db.permissions[role][key] = granted;
    },
  });

// ---------- Historique de connexion ----------

/** GET /users/{id}/login-history (ou /login-history pour tous, admin) */
export const getLoginHistory = (filters: LoginHistoryFilters, signal?: AbortSignal) =>
  api.get<LoginEvent[]>(
    `${filters.userId ? `/users/${filters.userId}/login-history` : "/login-history"}${query({ result: filters.result })}`,
    {
      signal,
      mock: () => {
        svc();
        return clone(
          db.history.filter(
            (e) => (!filters.userId || e.userId === filters.userId) && (!filters.result || (filters.result === "success") === e.success),
          ),
        );
      },
    },
  );
