import { ApiError } from "./errors";

/**
 * Client API unique de SmartCampus.
 * - Toutes les requêtes passent par l'API Gateway (VITE_API_BASE_URL).
 * - Intercepteur de requête : ajoute le JWT (Authorization: Bearer …).
 * - Intercepteur d'erreur : normalise les réponses (401/403/409/5xx) en ApiError.
 * - Mode mock (VITE_USE_MOCKS != "false") : la fonction `mock` fournie par chaque
 *   feature remplace l'appel réseau, avec une latence simulée.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081/api";
/**
 * user-service (module Utilisateurs) : service Node/Express sur le port 4001,
 * routes exposées sans préfixe /api (/auth, /users, /roles, /login-history).
 * Si une API Gateway route /api vers tous les services, mettez la même valeur
 * que VITE_API_BASE_URL.
 */
export const USER_API_BASE_URL = import.meta.env.VITE_USER_API_BASE_URL ?? "http://localhost:4001";
// Sans réglage explicite, un build de production parle au vrai service (jamais en mode démonstration avec changement de rôle).
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === undefined ? !import.meta.env.PROD : import.meta.env.VITE_USE_MOCKS !== "false";

/**
 * Routes servies par un vrai microservice quand VITE_USE_MOCKS=false (préfixes séparés par des virgules).
 * Toute autre route garde son mock tant que son service n'existe pas : on branche les modules un par un
 * en ajoutant leurs préfixes ici (ex. « /courses,/enrollments » pour academic). Défaut : user-service.
 */
const REAL_PREFIXES = (import.meta.env.VITE_REAL_API_PREFIXES ?? "/auth,/users,/roles,/login-history")
  .split(",")
  .map((p: string) => p.trim())
  .filter(Boolean);
const isRealRoute = (path: string) => REAL_PREFIXES.some((p: string) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));

/**
 * Avec le vrai user-service, la session vit dans des cookies `httpOnly` posés par le serveur : le JavaScript de la page
 * ne voit jamais les jetons (une faille XSS ne peut pas les voler). Le client envoie donc les cookies (`credentials`)
 * et l'en-tête `X-Auth-Mode: cookie` (qui sert aussi de protection CSRF côté serveur).
 * `tokenStore` ne sert plus qu'au mode mock (faux JWT de démonstration).
 *
 * Routage par microservice : chaque préfixe peut pointer vers une URL différente.
 * - user-service (Node/Express) : /auth, /users, /roles, /login-history → USER_API_BASE_URL
 * - tout le reste (académique, etc.) → API_BASE_URL
 * Le jour où une API Gateway unique existe, il suffit d'aligner les deux variables.
 */
const SERVICE_ROUTES: ReadonlyArray<{ prefixes: string[]; baseUrl: string }> = [
  { prefixes: ["/auth", "/users", "/roles", "/login-history"], baseUrl: USER_API_BASE_URL },
  // Résidences (NestJS, Chambre/Demande/Contrat) : /chambres, /demandes, /contrats → RESIDENCES_API_BASE_URL
  {
    prefixes: ["/chambres", "/demandes", "/contrats"],
    baseUrl: import.meta.env.VITE_RESIDENCES_API_BASE_URL ?? "http://localhost:3001/api",
  },
  // Bibliotheque (Python / FastAPI sur 8082) : /books, /loans, /reservations -> LIBRARY_API_BASE_URL
  {
    prefixes: ["/books", "/loans", "/reservations"],
    baseUrl: import.meta.env.VITE_LIBRARY_API_BASE_URL ?? "http://localhost:8082",
  },
  // Vie étudiante (Spring Boot sur 4005) : /clubs, /events, /memberships → STUDENT_LIFE_API_BASE_URL
  {
    prefixes: ["/clubs", "/events", "/memberships"],
    baseUrl: import.meta.env.VITE_STUDENT_LIFE_API_BASE_URL ?? "http://localhost:4005",
  },
];

const baseUrlFor = (path: string): string => {
  const route = SERVICE_ROUTES.find((r) => r.prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`)));
  return route?.baseUrl ?? API_BASE_URL;
};

const TOKEN_KEY = "smartcampus.jwt";
const AUTH_MODE_HEADERS = { "X-Auth-Mode": "cookie" } as const;

/** Nettoie les jetons laissés dans le navigateur par les versions précédentes (stockage lisible par le JS). */
if (!USE_MOCKS) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("smartcampus.refresh");
  } catch {
    /* stockage indisponible */
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* stockage indisponible */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* stockage indisponible */
    }
  },
};

/** Appelé quand la session ne peut plus être renouvelée (jeton expiré/révoqué, compte désactivé). */
const sessionExpiredListeners: Array<() => void> = [];
export const onSessionExpired = (fn: () => void) => {
  sessionExpiredListeners.push(fn);
  return () => {
    const i = sessionExpiredListeners.indexOf(fn);
    if (i >= 0) sessionExpiredListeners.splice(i, 1);
  };
};

/** Routes d'authentification publiques : un 401 y signifie « identifiants invalides », pas « session expirée ». */
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/verify-email"];

let refreshing: Promise<boolean> | null = null;
/** Renouvelle les cookies de session (rotation côté serveur). Une seule requête à la fois, partagée par les appels concurrents. */
function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${USER_API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...AUTH_MODE_HEADERS },
        body: "{}",
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ErrorInterceptor = (error: ApiError) => void;

const requestInterceptors: RequestInterceptor[] = [
  // Intercepteur JWT
  (config) => {
    const token = tokenStore.get();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
];
const errorInterceptors: ErrorInterceptor[] = [];

export const onRequest = (fn: RequestInterceptor) => void requestInterceptors.push(fn);
/** Ex. : rediriger vers la connexion sur 401. */
export const onError = (fn: ErrorInterceptor) => void errorInterceptors.push(fn);

export interface CallOptions<T> {
  body?: unknown;
  signal?: AbortSignal;
  /** Réponse fictive typée utilisée en mode mock. Peut lever une ApiError. */
  mock?: () => T | Promise<T>;
  /** Latence simulée (ms) en mode mock. */
  latency?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(method: RequestConfig["method"], path: string, opts: CallOptions<T> = {}, retried = false): Promise<T> {
  try {
    if (USE_MOCKS || (opts.mock && !isRealRoute(path))) {
      if (!opts.mock) throw new ApiError(404, `Aucun mock pour ${method} ${path}`);
      await sleep(opts.latency ?? 350 + Math.random() * 250);
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return await opts.mock();
    }

    let config: RequestConfig = {
      method,
      url: `${baseUrlFor(path)}${path}`,
      headers: {
        Accept: "application/json",
        ...AUTH_MODE_HEADERS,
        // Un corps FormData (upload multipart) doit définir son propre Content-Type avec boundary.
        ...(opts.body && !(typeof FormData !== "undefined" && opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body,
      signal: opts.signal,
    };
    for (const intercept of requestInterceptors) config = await intercept(config);

    const isFormData = typeof FormData !== "undefined" && config.body instanceof FormData;
    let res: Response;
    try {
      res = await fetch(config.url, {
        method: config.method,
        credentials: "include",
        headers: config.headers,
        body: isFormData ? (config.body as FormData) : config.body ? JSON.stringify(config.body) : undefined,
        signal: config.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new ApiError(0, "Impossible de joindre l'API Gateway");
    }
    if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
      if (await refreshSession()) return await request<T>(method, path, opts, true);
      tokenStore.clear();
      sessionExpiredListeners.forEach((fn) => fn());
    }
    if (!res.ok) {
      const details = await res.json().catch(() => undefined);
      throw new ApiError(res.status, (details as { message?: string } | undefined)?.message ?? res.statusText, details);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  } catch (e) {
    if (e instanceof ApiError) errorInterceptors.forEach((fn) => fn(e));
    throw e;
  }
}

export const api = {
  get: <T>(path: string, opts?: CallOptions<T>) => request<T>("GET", path, opts),
  post: <T>(path: string, opts?: CallOptions<T>) => request<T>("POST", path, opts),
  put: <T>(path: string, opts?: CallOptions<T>) => request<T>("PUT", path, opts),
  patch: <T>(path: string, opts?: CallOptions<T>) => request<T>("PATCH", path, opts),
  delete: <T>(path: string, opts?: CallOptions<T>) => request<T>("DELETE", path, opts),
};
