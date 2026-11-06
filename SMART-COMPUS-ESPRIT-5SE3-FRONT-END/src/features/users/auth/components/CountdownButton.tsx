import { useCallback, useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/shared/components/ui/button";

interface CountdownButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  /** Durée de l'attente entre deux envois (s). */
  seconds?: number;
  /** Démarre le compte à rebours dès l'affichage (e-mail déjà envoyé). */
  startCounting?: boolean;
  label: string;
  /** Libellé pendant l'attente, ex. « Renvoyer dans 42 s ». */
  countdownLabel: (remaining: number) => string;
  /** Si la promesse échoue, le compte à rebours ne démarre pas. */
  onClick: () => Promise<unknown> | void;
}

/** Bouton d'action à débit limité : désactivé pendant le compte à rebours. */
export function CountdownButton({
  seconds = 60,
  startCounting = false,
  label,
  countdownLabel,
  onClick,
  disabled,
  ...props
}: CountdownButtonProps) {
  const [remaining, setRemaining] = useState(startCounting ? seconds : 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const handle = useCallback(async () => {
    setBusy(true);
    try {
      await onClick();
      setRemaining(seconds);
    } catch {
      /* l'appelant affiche l'erreur ; pas de compte à rebours */
    } finally {
      setBusy(false);
    }
  }, [onClick, seconds]);

  const counting = remaining > 0;
  return (
    <Button type="button" {...props} disabled={disabled || counting || busy} aria-busy={busy || undefined} onClick={() => void handle()}>
      {counting ? countdownLabel(remaining) : label}
    </Button>
  );
}
