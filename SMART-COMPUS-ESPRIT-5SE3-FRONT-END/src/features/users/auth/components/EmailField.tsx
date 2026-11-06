import type { ReactNode } from "react";
import { useT } from "@/shared/i18n";
import { Field, inputClass, messageId } from "./Field";
import { INSTITUTIONAL_DOMAIN } from "../../utils/validation";

interface EmailFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
  disabled?: boolean;
  /** "username" sur la connexion (gestionnaires de mots de passe), "email" ailleurs. */
  autoComplete?: "username" | "email";
  label?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

/** Champ e-mail institutionnel : clavier e-mail sur mobile, pas de correction automatique. */
export function EmailField({ id, value, onChange, error, disabled, autoComplete = "email", label, autoFocus, readOnly }: EmailFieldProps) {
  const t = useT();
  return (
    <Field id={id} label={label ?? t("users.field.email")} required error={error}>
      <input
        id={id}
        name="email"
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- le focus est demandé explicitement par la page appelante
        autoFocus={autoFocus}
        readOnly={readOnly}
        disabled={disabled}
        required
        value={value}
        placeholder={`prenom.nom@${INSTITUTIONAL_DOMAIN}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId(id)}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(Boolean(error))}
      />
    </Field>
  );
}
