import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthValue } from "@/shared/auth/AuthContext";
import { I18nProvider } from "@/shared/i18n";
import { AssistantError, type AssistantReply } from "@/shared/services/assistant";
import type * as AssistantModule from "@/shared/services/assistant";

const ask = vi.fn();
const confirm = vi.fn();
const cancel = vi.fn();
vi.mock("@/shared/services/assistant", async (orig) => ({
  ...(await orig<typeof AssistantModule>()),
  askAssistant: (...a: unknown[]) => ask(...a),
  confirmAssistantAction: (...a: unknown[]) => confirm(...a),
  cancelAssistantAction: (...a: unknown[]) => cancel(...a),
}));

import { AssistantWidget } from "./AssistantWidget";

const auth = (isAuthenticated: boolean) =>
  ({ isAuthenticated, role: "student", user: { id: "ETU-1", name: "Amel" } }) as unknown as AuthValue;
const wrap = (ui: ReactElement, isAuthenticated = true) => (
  <I18nProvider>
    <AuthContext.Provider value={auth(isAuthenticated)}>{ui}</AuthContext.Provider>
  </I18nProvider>
);
const reply = (over: Partial<AssistantReply> = {}): AssistantReply => ({
  answer: "Une semaine.",
  confidence: "high",
  conversation_id: "conv-12345",
  actions: [],
  sources: ["Règlement intérieur > Absences"],
  ...over,
});

async function openAndAsk(text = "Délai pour justifier une absence ?") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouvrir l'assistant" }));
  await user.type(screen.getByRole("textbox", { name: "Votre question…" }), text);
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  return user;
}

describe("assistant intégré à l'application", () => {
  beforeEach(() => {
    ask.mockReset();
    confirm.mockReset();
    cancel.mockReset();
  });

  it("n'apparaît pas sans session", () => {
    render(wrap(<AssistantWidget />, false));
    expect(screen.queryByRole("button", { name: "Ouvrir l'assistant" })).not.toBeInTheDocument();
  });

  it("répond avec ses sources et garde la conversation entre deux questions", async () => {
    ask.mockResolvedValue(reply());
    render(wrap(<AssistantWidget />));
    const user = await openAndAsk();
    expect(await screen.findByText("Une semaine.")).toBeInTheDocument();
    expect(screen.getByText(/Règlement intérieur > Absences/)).toBeInTheDocument();
    expect(ask.mock.calls[0]![0]).toMatchObject({ message: "Délai pour justifier une absence ?", conversationId: null });

    await user.type(screen.getByRole("textbox", { name: "Votre question…" }), "Et pour les cours du soir ?");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[1]![0]).toMatchObject({ conversationId: "conv-12345" });
  });

  it("affiche un message clair quand l'assistant est très sollicité", async () => {
    ask.mockRejectedValue(new AssistantError("busy"));
    render(wrap(<AssistantWidget />));
    await openAndAsk();
    expect(await screen.findByText(/très sollicité/)).toBeInTheDocument();
  });

  it("affiche une fiabilité faible", async () => {
    ask.mockResolvedValue(reply({ confidence: "low" }));
    render(wrap(<AssistantWidget />));
    await openAndAsk();
    expect(await screen.findByText(/Fiabilité faible/)).toBeInTheDocument();
  });

  it("exige un clic pour appliquer une modification proposée, puis la confirme", async () => {
    const action = {
      tool: "propose_phone_update",
      status: "needs_confirmation" as const,
      confirmation_id: "act-1",
      summary: "Remplacer votre numéro par +216 22 222 222",
    };
    ask.mockResolvedValue(reply({ answer: "Je prépare la modification.", actions: [action] }));
    confirm.mockResolvedValue({ status: "done", summary: null });
    render(wrap(<AssistantWidget />));
    const user = await openAndAsk("Change mon numéro");
    expect(await screen.findByText(/Remplacer votre numéro/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled(); // rien n'est appliqué tant que l'utilisateur n'a pas cliqué
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(confirm).toHaveBeenCalledWith("act-1");
    expect(await screen.findByText("Modification effectuée.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmer" })).not.toBeInTheDocument();
  });

  it("montre les outils que l'agent a réellement utilisés", async () => {
    ask.mockResolvedValue(
      reply({
        actions: [
          { tool: "list_rooms", status: "done" },
          { tool: "check_room_availability", status: "done" },
          { tool: "list_rooms", status: "done" },
          { tool: "propose_room_reservation", status: "needs_confirmation", confirmation_id: "act-9", summary: "Réserver Salle C12" },
        ],
      }),
    );
    render(wrap(<AssistantWidget />));
    await openAndAsk("Réserve-moi une salle");
    const line = await screen.findByTestId("assistant-tools");
    expect(line).toHaveTextContent("Outils utilisés : Salles · Disponibilité des salles"); // sans doublon, sans l'outil à confirmer
    expect(screen.getByText(/Réserver Salle C12/)).toBeInTheDocument();
  });

  it("affiche le résultat réel de l'action confirmée, ou la raison du refus du service", async () => {
    const action = (id: string) => ({
      tool: "propose_room_reservation",
      status: "needs_confirmation" as const,
      confirmation_id: id,
      summary: "Réserver Salle C12",
    });
    ask.mockResolvedValueOnce(reply({ actions: [action("act-ok")] }));
    confirm.mockResolvedValueOnce({ status: "done", summary: "Réservation enregistrée : Salle C12 (en attente de validation)." });
    render(wrap(<AssistantWidget />));
    const user = await openAndAsk("Réserve");
    await user.click(await screen.findByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Réservation enregistrée : Salle C12/)).toBeInTheDocument();

    ask.mockResolvedValueOnce(reply({ actions: [action("act-ko")] }));
    confirm.mockResolvedValueOnce({ status: "error", summary: "Demande refusée par le service resources : Salle déjà réservée." });
    await user.type(screen.getByRole("textbox", { name: "Votre question…" }), "Encore");
    await user.click(screen.getByRole("button", { name: "Envoyer" }));
    await user.click(await screen.findByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Salle déjà réservée/)).toBeInTheDocument();
  });

  it("annule une modification proposée sans l'exécuter", async () => {
    const action = {
      tool: "propose_phone_update",
      status: "needs_confirmation" as const,
      confirmation_id: "act-2",
      summary: "Changer le numéro",
    };
    ask.mockResolvedValue(reply({ actions: [action] }));
    cancel.mockResolvedValue(undefined);
    render(wrap(<AssistantWidget />));
    const user = await openAndAsk();
    await user.click(await screen.findByRole("button", { name: "Annuler" }));
    expect(cancel).toHaveBeenCalledWith("act-2");
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText("Modification annulée.")).toBeInTheDocument();
  });

  it("signale l'échec d'une confirmation (action expirée)", async () => {
    const action = { tool: "propose_phone_update", status: "needs_confirmation" as const, confirmation_id: "act-3", summary: "Changer" };
    ask.mockResolvedValue(reply({ actions: [action] }));
    confirm.mockRejectedValue(new AssistantError("unknown"));
    render(wrap(<AssistantWidget />));
    const user = await openAndAsk();
    await user.click(await screen.findByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText("La modification n'a pas pu être effectuée.")).toBeInTheDocument();
  });

  it("refuse une image qui n'est ni JPEG, PNG ni WebP", async () => {
    render(wrap(<AssistantWidget />));
    const user = userEvent.setup({ applyAccept: false });
    await user.click(screen.getByRole("button", { name: "Ouvrir l'assistant" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(["x"], "virus.svg", { type: "image/svg+xml" }));
    expect(await screen.findByText(/Image refusée/)).toBeInTheDocument();
  });

  it("n'insère jamais de HTML venu de l'assistant", async () => {
    ask.mockResolvedValue(reply({ answer: '<img src=x onerror="alert(1)"> <b>gras</b>' }));
    render(wrap(<AssistantWidget />));
    await openAndAsk();
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("section b")).toBeNull();
  });

  it("se ferme avec Échap et rend le focus au bouton", async () => {
    render(wrap(<AssistantWidget />));
    const user = userEvent.setup();
    const fab = screen.getByRole("button", { name: "Ouvrir l'assistant" });
    await user.click(fab);
    expect(screen.getByRole("dialog", { name: "Assistant SmartCampus" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ouvrir l'assistant" })).toHaveFocus();
  });

  it("efface la conversation quand la session se ferme", async () => {
    ask.mockResolvedValue(reply());
    const { rerender } = render(wrap(<AssistantWidget />));
    await openAndAsk();
    await screen.findByText("Une semaine.");
    rerender(wrap(<AssistantWidget />, false));
    expect(screen.queryByText("Une semaine.")).not.toBeInTheDocument();
    rerender(wrap(<AssistantWidget />, true));
    await userEvent.setup().click(screen.getByRole("button", { name: "Ouvrir l'assistant" }));
    expect(screen.queryByText("Une semaine.")).not.toBeInTheDocument();
  });
});
