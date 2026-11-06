import { useState, type ReactNode } from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { useT } from "@/shared/i18n";
import { Field, inputClass, messageId } from "./Field";
import { PasswordStrength } from "./PasswordStrength";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "current-password" (connexion) ou "new-password" (création / réinitialisation). */
  autoComplete: "current-password" | "new-password";
  error?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  showStrength?: boolean;
  autoFocus?: boolean;
  name?: string;
}

/**
 * Champ mot de passe : afficher/masquer, avertissement Verr. Maj, jauge de robustesse optionnelle.
 * Le collage reste autorisé (gestionnaires de mots de passe).
 */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  disabled,
  required = true,
  showStrength,
  autoFocus,
  name,
}: PasswordInputProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const trackCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"));

  const capsWarning = capsLock && (
    <p className="flex items-center gap-1.5 font-medium text-amber-900">
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      {t("users.capsLock")}
    </p>
  );

  return (
    <div>
      <Field id={id} label={label} required={required} error={error} hint={capsWarning || hint}>
        <div className="relative">
          <input
            id={id}
            name={name ?? (autoComplete === "current-password" ? "password" : "new-password")}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- le focus est demandé explicitement par la page appelante
            autoFocus={autoFocus}
            disabled={disabled}
            required={required}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId(id)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={trackCaps}
            onKeyUp={trackCaps}
            onBlur={() => setCapsLock(false)}
            className={`${inputClass(Boolean(error))} pr-12`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={disabled}
            aria-pressed={visible}
            aria-controls={id}
            aria-label={visible ? t("users.password.hide") : t("users.password.show")}
            className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-md text-slate-600 transition-colors duration-150 hover:bg-secondary"
          >
            {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </Field>
      {showStrength && <PasswordStrength password={value} />}
    </div>
  );
}
