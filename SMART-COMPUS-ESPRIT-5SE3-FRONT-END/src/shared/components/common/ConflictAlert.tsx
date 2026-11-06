import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

interface ConflictAlertProps {
  title?: string;
  description?: ReactNode;
  /** Éléments en conflit (ex. « Amphi A — 10:00–12:00 »). */
  conflicts?: string[];
  action?: ReactNode;
  className?: string;
}

/** Affiche une erreur 409 (double réservation, créneau pris, etc.). */
export function ConflictAlert({ title, description, conflicts, action, className }: ConflictAlertProps) {
  const t = useT();
  return (
    <div role="alert" className={cn("flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950", className)}>
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold">{title ?? t("error.409.title")}</p>
        <p className="text-sm">{description ?? t("error.409.description")}</p>
        {conflicts && conflicts.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {action}
      </div>
    </div>
  );
}
