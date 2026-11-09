import { api, USE_MOCKS } from "@/shared/api/client";

/**
 * Client de l'assistant IA (agent-service). Même session que le reste de l'application : le navigateur joint le cookie
 * `httpOnly` `sc_access` (les cookies de « localhost » sont partagés entre ports), le JavaScript ne voit jamais de jeton.
 * `X-Auth-Mode: cookie` sert de protection CSRF côté agent, comme pour le user-service.
 */
export const AGENT_URL = (import.meta.env.VITE_AGENT_URL ?? "http://localhost:4010").replace(/\/$/, "");

export type AssistantConfidence = "low" | "medium" | "high";
export type AssistantActionStatus = "done" | "denied" | "error" | "needs_confirmation";

export interface AssistantAction {
  tool: string;
  status: AssistantActionStatus;
  confirmation_id?: string | null;
  summary?: string | null;
}

export interface AssistantReply {
  answer: string;
  confidence: AssistantConfidence;
  conversation_id: string;
  actions: AssistantAction[];
  sources: string[];
}

export interface AssistantImage {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface AssistantRequest {
  message: string;
  conversationId?: string | null;
  image?: AssistantImage | null;
}

export type AssistantErrorKind = "unavailable" | "busy" | "auth" | "network" | "rejected" | "unknown";

export class AssistantError extends Error {
  constructor(
    public readonly kind: AssistantErrorKind,
    public readonly detail?: string,
  ) {
    super(kind);
    this.name = "AssistantError";
  }
}

const kindOf = (status: number): AssistantErrorKind => {
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || status === 503) return "busy";
  if (status === 413 || status === 422 || status === 400) return "rejected";
  if (status === 501) return "unavailable";
  return "unknown";
};

async function post<T>(path: string, body: unknown, signal?: AbortSignal, retried = false): Promise<T> {
  if (USE_MOCKS) throw new AssistantError("unavailable");
  let res: Response;
  try {
    res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Auth-Mode": "cookie" },
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AssistantError("network");
  }
  if (res.status === 401 && !retried) {
    // Jeton d'accès expiré : on renouvelle la session via le user-service (rotation des cookies), puis on réessaie une fois.
    try {
      await api.post("/auth/refresh", { body: {}, mock: () => undefined });
    } catch {
      throw new AssistantError("auth");
    }
    return post<T>(path, body, signal, true);
  }
  if (!res.ok) {
    const payload = (await res.json().catch(() => undefined)) as { detail?: unknown } | undefined;
    throw new AssistantError(kindOf(res.status), typeof payload?.detail === "string" ? payload.detail : undefined);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function askAssistant(req: AssistantRequest, signal?: AbortSignal): Promise<AssistantReply> {
  return post<AssistantReply>(
    "/agent/chat",
    {
      message: req.message,
      ...(req.conversationId ? { conversation_id: req.conversationId } : {}),
      ...(req.image ? { image_b64: req.image.base64, image_media_type: req.image.mediaType } : {}),
    },
    signal,
  );
}

/** Exécute une modification PROPOSÉE par l'assistant, après clic de l'utilisateur (usage unique côté serveur). */
export async function confirmAssistantAction(id: string): Promise<AssistantActionStatus> {
  const res = await post<{ action: { status: AssistantActionStatus } }>(`/agent/actions/${encodeURIComponent(id)}/confirm`, {});
  return res.action.status;
}

export function cancelAssistantAction(id: string): Promise<void> {
  return post<void>(`/agent/actions/${encodeURIComponent(id)}/cancel`, {});
}
