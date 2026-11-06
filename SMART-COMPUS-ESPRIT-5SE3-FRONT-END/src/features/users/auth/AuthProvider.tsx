import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, onSessionExpired, tokenStore, USE_MOCKS } from "@/shared/api/client";
import { fakeJwt } from "@/shared/auth/jwt";
import { DEMO_USERS, ROLES, type Role, type User } from "@/shared/auth/roles";
import { AuthContext, type AuthValue } from "@/shared/auth/AuthContext";
import { storedAvatar } from "../mocks";

const SESSION_KEY = "smartcampus.session";

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as User;
    return u && typeof u.id === "string" && ROLES.includes(u.role) ? u : null;
  } catch {
    return null;
  }
}

function writeSession(user: User | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<User | null>(readSession);
  const user = session ?? DEMO_USERS.student;

  // Synchronise le token avec la session :
  // - En mode mock (VITE_USE_MOCKS=true) : fakeJwt pour les appels simulés
  // - En mode réel : le vrai token JWT vient du module User via login()
  useEffect(() => {
    if (!session) {
      tokenStore.clear();
    } else if (USE_MOCKS) tokenStore.set(fakeJwt(session));
  }, [session]);

  const open = useCallback((u: User) => {
    setSession(u);
    writeSession(u);
  }, []);

  const login = useCallback(
    (u: User, token?: string) => {
      if (token) tokenStore.set(token); // mode mock uniquement : avec le vrai service, la session est dans des cookies httpOnly
      open(u);
    },
    [open],
  );

  const setRole = useCallback(
    (r: Role) => {
      const u = { ...DEMO_USERS[r], avatarUrl: storedAvatar(DEMO_USERS[r].id) };
      // Session de démo : jeton fictif pour que les appels API portent un Authorization,
      // même quand VITE_USE_MOCKS=false (backend académique sans sécurité pour l'instant).
      tokenStore.set(fakeJwt(u));
      open(u);
    },
    [open],
  );

  const updateUser = useCallback<AuthValue["updateUser"]>((patch) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, ...patch };
      writeSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    // Révoque la session côté serveur et efface les cookies (best effort : la déconnexion locale ne dépend pas de la réponse).
    if (!USE_MOCKS) void api.post("/auth/logout", { mock: () => undefined }).catch(() => undefined);
    setSession(null);
    writeSession(null);
  }, []);

  // Session non renouvelable (401 après tentative de refresh) : on déconnecte vraiment l'interface.
  useEffect(
    () =>
      onSessionExpired(() => {
        setSession(null);
        writeSession(null);
      }),
    [],
  );

  const value = useMemo(
    () => ({ user, role: user.role, isAuthenticated: session !== null, login, setRole, updateUser, logout }),
    [user, session, login, setRole, updateUser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
