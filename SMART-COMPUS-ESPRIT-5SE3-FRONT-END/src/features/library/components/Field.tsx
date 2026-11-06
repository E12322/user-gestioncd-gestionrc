import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { useT } from "@/shared/i18n";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Champ de formulaire : label lié, astérisque + texte masqué pour « obligatoire », erreur reliée par aria-describedby. */
export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {!optional && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-red-700">
              *
            </span>
            <span className="sr-only"> ({t("lib.form.required")})</span>
          </>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Attributs d'accessibilité d'un champ en erreur. */
export const fieldA11y = (id: string, error?: string, hint?: string) => ({
  "aria-invalid": error ? (true as const) : undefined,
  "aria-describedby": [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined,
});
