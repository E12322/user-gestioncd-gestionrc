import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: ReactNode;
  /** Message d'aide ou avertissement affiché quand il n'y a pas d'erreur (ex. Verr. Maj). */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Id du message du champ (à passer en aria-describedby sur le contrôle). */
export const messageId = (id: string) => `${id}-msg`;

/**
 * Label toujours visible + emplacement de message de hauteur réservée :
 * l'apparition d'une erreur ne déplace pas les champs suivants.
 */
export function Field({ id, label, required, error, hint, children, className }: FieldProps) {
  const t = useT();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-red-700">
              *
            </span>
            <span className="sr-only"> ({t("users.required")})</span>
          </>
        )}
      </label>
      {children}
      <div id={messageId(id)} aria-live="polite" className="min-h-5 pt-1 text-sm leading-5">
        {error ? (
          <p className="flex items-start gap-1.5 text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : (
          hint && <div className="text-muted-foreground">{hint}</div>
        )}
      </div>
    </div>
  );
}

/** Classes communes des champs de saisie (bordure rouge si invalide, transition 150 ms). */
export const inputClass = (invalid: boolean) =>
  cn(
    "h-11 w-full rounded-lg border bg-card px-3 text-sm placeholder:text-muted-foreground transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    invalid ? "border-red-600" : "border-input",
  );
