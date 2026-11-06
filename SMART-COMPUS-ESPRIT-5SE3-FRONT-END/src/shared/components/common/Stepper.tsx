import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface Step {
  label: string;
  description?: string;
}

/** Étapes d'un parcours (ex. demande d'hébergement). `current` est l'index (0-based) de l'étape active. */
export function Stepper({ steps, current, className }: { steps: Step[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Progression">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={step.label}
            className="relative flex flex-1 flex-col items-center text-center"
            aria-current={active ? "step" : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", i <= current ? "bg-primary" : "bg-slate-200")}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-card text-primary",
                !done && !active && "border-slate-300 bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              <span className="sr-only">{done ? " (terminée)" : active ? " (en cours)" : " (à venir)"}</span>
            </span>
            <span className={cn("mt-2 px-1 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
            {step.description && <span className="px-1 text-xs text-muted-foreground">{step.description}</span>}
          </li>
        );
      })}
    </ol>
  );
}
