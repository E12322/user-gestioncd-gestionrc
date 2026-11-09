import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, ImagePlus, Mic, Plus, Send, Volume2, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import {
  AssistantError,
  askAssistant,
  cancelAssistantAction,
  confirmAssistantAction,
  type AssistantAction,
  type AssistantImage,
  type AssistantReply,
} from "@/shared/services/assistant";

/**
 * Assistant IA accessible depuis toute l'application (bouton flottant). Il parle à l'agent-service avec la session de
 * l'utilisateur : il ne peut donc jamais voir ni faire plus que lui. Toute modification qu'il propose exige un clic ici.
 */

const SPEAK_KEY = "smartcampus.assistantSpeak";
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Message = { id: number; from: "user" | "bot" | "error"; text: string; reply?: AssistantReply; image?: string };
type ResolveState = "pending" | "confirmed" | "cancelled" | "failed";
type AttachedImage = AssistantImage & { name: string };

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;
const recognitionCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* stockage indisponible */
  }
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

function AssistantChat() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [speak, setSpeak] = useState(() => readFlag(SPEAK_KEY));
  const [listening, setListening] = useState(false);
  const [resolved, setResolved] = useState<Record<string, ResolveState>>({});
  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const push = useCallback((m: Omit<Message, "id">) => setMessages((prev) => [...prev, { ...m, id: nextId.current++ }]), []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, busy]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const errorText = (e: unknown) => {
    if (e instanceof AssistantError) {
      const key = `assistant.error.${e.kind}`;
      const base = t(key);
      return e.kind === "rejected" && e.detail ? `${base} ${e.detail}` : base;
    }
    return t("assistant.error.unknown");
  };

  const readAloud = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    window.speechSynthesis.speak(u);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const attached = image;
    push({ from: "user", text, image: attached?.name });
    setInput("");
    setImage(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const reply = await askAssistant(
        { message: text, conversationId, image: attached ? { base64: attached.base64, mediaType: attached.mediaType } : null },
        ctrl.signal,
      );
      setConversationId(reply.conversation_id);
      push({ from: "bot", text: reply.answer, reply });
      if (speak) readAloud(reply.answer);
    } catch (e) {
      if ((e as Error).name !== "AbortError") push({ from: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };
  const onInputKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  const toggleSpeak = () => {
    const next = !speak;
    setSpeak(next);
    writeFlag(SPEAK_KEY, next);
    if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const heard = e.results[0]?.[0]?.transcript ?? "";
      if (heard) setInput((prev) => (prev ? `${prev} ${heard}` : heard));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const onPickImage = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const type = ACCEPTED_IMAGES.find((x) => x === file.type);
    if (!type || file.size > MAX_IMAGE_BYTES) {
      push({ from: "error", text: t("assistant.imageInvalid") });
      return;
    }
    try {
      setImage({ base64: await fileToBase64(file), mediaType: type, name: file.name });
    } catch {
      push({ from: "error", text: t("assistant.imageInvalid") });
    }
  };

  const decide = async (action: AssistantAction, accept: boolean) => {
    const id = action.confirmation_id;
    if (!id) return;
    setResolved((r) => ({ ...r, [id]: "pending" }));
    try {
      if (accept) {
        const status = await confirmAssistantAction(id);
        setResolved((r) => ({ ...r, [id]: status === "done" ? "confirmed" : "failed" }));
      } else {
        await cancelAssistantAction(id);
        setResolved((r) => ({ ...r, [id]: "cancelled" }));
      }
    } catch {
      setResolved((r) => ({ ...r, [id]: "failed" }));
    }
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setResolved({});
    setImage(null);
    setBusy(false);
  };

  const hasRecognition = typeof window !== "undefined" && recognitionCtor() !== undefined;

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? t("assistant.close") : t("assistant.open")}
        className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:bottom-6 lg:right-6"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <Bot className="size-6" aria-hidden="true" />}
      </button>

      {open && (
        <section
          id="assistant-panel"
          role="dialog"
          aria-label={t("assistant.title")}
          className="fixed inset-x-2 bottom-36 z-40 flex max-h-[70vh] flex-col rounded-2xl border border-input bg-card shadow-xl sm:inset-x-auto sm:right-4 sm:w-[24rem] lg:bottom-24 lg:right-6 lg:w-[26rem]"
        >
          <header className="flex items-center gap-2 border-b border-input px-4 py-3">
            <Bot className="size-5 text-primary" aria-hidden="true" />
            <h2 className="flex-1 text-sm font-semibold">{t("assistant.title")}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={newChat}
              aria-label={t("assistant.newChat")}
              title={t("assistant.newChat")}
            >
              <Plus aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={speak ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleSpeak}
              aria-pressed={speak}
              aria-label={t("assistant.speak")}
              title={t("assistant.speak")}
            >
              <Volume2 aria-hidden="true" />
            </Button>
          </header>

          <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && <p className="text-sm text-muted-foreground">{t("assistant.welcome")}</p>}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-1", m.from === "user" && "items-end")}>
                <div
                  className={cn(
                    "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                    m.from === "user" && "bg-primary text-primary-foreground",
                    m.from === "bot" && "bg-secondary text-secondary-foreground",
                    m.from === "error" && "bg-destructive/10 text-destructive",
                  )}
                >
                  {m.text}
                </div>
                {m.image && <span className="text-xs text-muted-foreground">📎 {m.image}</span>}
                {m.reply && m.reply.confidence === "low" && (
                  <span className="text-xs italic text-muted-foreground">{t("assistant.confidence.low")}</span>
                )}
                {m.reply && m.reply.sources.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t("assistant.sources")} :</span> {m.reply.sources.join(" · ")}
                  </p>
                )}
                {m.reply?.actions
                  .filter((a) => a.status === "needs_confirmation" && a.confirmation_id)
                  .map((a) => {
                    const state = resolved[a.confirmation_id!];
                    return (
                      <div key={a.confirmation_id} className="w-full rounded-lg border border-input p-2 text-sm">
                        <p className="mb-2">{a.summary}</p>
                        {state === undefined || state === "pending" ? (
                          <div className="flex gap-2">
                            <Button type="button" size="sm" disabled={state === "pending"} onClick={() => void decide(a, true)}>
                              {t("assistant.confirm")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={state === "pending"}
                              onClick={() => void decide(a, false)}
                            >
                              {t("assistant.cancel")}
                            </Button>
                          </div>
                        ) : (
                          <p role="status" className={state === "confirmed" ? "text-emerald-700" : "text-muted-foreground"}>
                            {state === "confirmed" && t("assistant.confirmed")}
                            {state === "cancelled" && t("assistant.cancelled")}
                            {state === "failed" && t("assistant.confirmFailed")}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
            {busy && (
              <p className="text-sm text-muted-foreground" role="status">
                {t("assistant.thinking")}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t border-input p-3">
            {image && (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">📎 {image.name}</span>
                <button type="button" onClick={() => setImage(null)} className="underline">
                  {t("assistant.removeImage")}
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
                rows={2}
                maxLength={4000}
                placeholder={listening ? t("assistant.listening") : t("assistant.placeholder")}
                aria-label={t("assistant.placeholder")}
                className="min-h-10 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_IMAGES.join(",")}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => void onPickImage(e.target.files?.[0])}
                />
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9"
                    onClick={() => fileRef.current?.click()}
                    aria-label={t("assistant.attach")}
                    title={t("assistant.attach")}
                  >
                    <ImagePlus aria-hidden="true" />
                  </Button>
                  {hasRecognition && (
                    <Button
                      type="button"
                      variant={listening ? "secondary" : "outline"}
                      size="icon"
                      className="size-9"
                      onClick={toggleMic}
                      aria-pressed={listening}
                      aria-label={t("assistant.mic")}
                      title={t("assistant.mic")}
                    >
                      <Mic aria-hidden="true" />
                    </Button>
                  )}
                  <Button type="submit" size="icon" className="size-9" disabled={busy || !input.trim()} aria-label={t("assistant.send")}>
                    <Send aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

/** Visible dans toute l'application dès qu'une session existe. `key` : changer d'utilisateur ou se déconnecter jette la conversation. */
export function AssistantWidget() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return null;
  return <AssistantChat key={user.id} />;
}
