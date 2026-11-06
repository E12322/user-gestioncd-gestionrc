import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Appelé quand les 6 chiffres sont saisis (y compris par collage). */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  label: string;
}

/** Saisie d'un code à usage unique : avance automatique, retour arrière, flèches, collage du code complet. */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled, invalid, describedBy, label }: OtpInputProps) {
  const t = useT();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  }

  function onInput(i: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // Plusieurs chiffres d'un coup (saisie rapide, remplissage automatique) : on les répartit.
    const next = commit(value.slice(0, i) + typed + value.slice(i + typed.length));
    focus(Math.min(i + typed.length, length - 1, next.length));
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) commit(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        commit(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const clean = commit(e.clipboardData.getData("text"));
    focus(Math.min(clean.length, length - 1));
  }

  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex justify-center gap-2 sm:gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          pattern="\d*"
          maxLength={length}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          aria-label={t("users.verify.digit", { n: i + 1, total: length })}
          aria-invalid={invalid || undefined}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "size-11 rounded-lg border bg-card text-center text-lg font-semibold sm:size-12 disabled:opacity-50",
            invalid ? "border-red-600" : "border-input",
          )}
        />
      ))}
    </div>
  );
}
