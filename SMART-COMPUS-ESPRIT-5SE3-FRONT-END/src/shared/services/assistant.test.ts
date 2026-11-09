import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("@/shared/api/client", () => ({ USE_MOCKS: false, api: { post: (...a: unknown[]) => refresh(...a) } }));

import { AGENT_URL, AssistantError, askAssistant, cancelAssistantAction, confirmAssistantAction } from "./assistant";

const ok = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });
const REPLY = { answer: "Une semaine.", confidence: "high", conversation_id: "abc12345", actions: [], sources: ["Règlement intérieur"] };

describe("client de l'assistant", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    refresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("envoie la session par cookie avec l'en-tête anti-CSRF, sans jamais manipuler de jeton", async () => {
    fetchMock.mockResolvedValue(ok(REPLY));
    const reply = await askAssistant({ message: "Délai ?", conversationId: "abc12345" });
    expect(reply.answer).toBe("Une semaine.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AGENT_URL}/agent/chat`);
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Auth-Mode"]).toBe("cookie");
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual({ message: "Délai ?", conversation_id: "abc12345" });
  });

  it("joint l'image au format attendu par l'agent", async () => {
    fetchMock.mockResolvedValue(ok(REPLY));
    await askAssistant({ message: "Que voit-on ?", image: { base64: "QUJD", mediaType: "image/png" } });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ image_b64: "QUJD", image_media_type: "image/png" });
    expect(body.conversation_id).toBeUndefined();
  });

  it.each([
    [429, "busy"],
    [503, "busy"],
    [422, "rejected"],
    [403, "auth"],
    [501, "unavailable"],
    [500, "unknown"],
  ])("traduit le statut %i en erreur « %s »", async (status, kind) => {
    fetchMock.mockResolvedValue(ok({ detail: "détail" }, status));
    await expect(askAssistant({ message: "x" })).rejects.toMatchObject({ kind });
  });

  it("signale un agent injoignable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(askAssistant({ message: "x" })).rejects.toMatchObject({ kind: "network" });
  });

  it("renouvelle la session sur 401 puis réessaie une seule fois", async () => {
    fetchMock.mockResolvedValueOnce(ok({}, 401)).mockResolvedValueOnce(ok(REPLY));
    refresh.mockResolvedValue(undefined);
    await expect(askAssistant({ message: "x" })).resolves.toMatchObject({ answer: "Une semaine." });
    expect(refresh).toHaveBeenCalledWith("/auth/refresh", expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("abandonne si la session ne peut pas être renouvelée (pas de boucle)", async () => {
    fetchMock.mockResolvedValue(ok({}, 401));
    refresh.mockRejectedValue(new Error("expirée"));
    await expect(askAssistant({ message: "x" })).rejects.toMatchObject({ kind: "auth" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("n'essaie pas plus d'une fois même si le 401 persiste après renouvellement", async () => {
    fetchMock.mockResolvedValue(ok({}, 401));
    refresh.mockResolvedValue(undefined);
    await expect(askAssistant({ message: "x" })).rejects.toBeInstanceOf(AssistantError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("confirme et annule une action par son identifiant (encodé)", async () => {
    fetchMock.mockResolvedValueOnce(ok({ action: { status: "done" } })).mockResolvedValueOnce(ok(null, 204));
    await expect(confirmAssistantAction("a/b c")).resolves.toBe("done");
    await expect(cancelAssistantAction("id1")).resolves.toBeUndefined();
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(`${AGENT_URL}/agent/actions/a%2Fb%20c/confirm`);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(`${AGENT_URL}/agent/actions/id1/cancel`);
  });
});
