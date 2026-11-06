import type { ReactNode } from "react";
import { TONES, type Tone } from "@/shared/lib/tones";
import { cn } from "@/shared/lib/utils";

export interface TimelineItem {
  id: string;
  title: string;
  description?: ReactNode;
  date: string;
  tone?: Tone;
}

/** Historique vertical (ex. suivi d'une demande). */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-5 border-l border-border pl-6", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden="true"
            className={cn("absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-card", TONES[item.tone ?? "navy"].dot)}
          />
          <p className="text-sm font-semibold">{item.title}</p>
          {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
          <time className="text-xs text-muted-foreground">{item.date}</time>
        </li>
      ))}
    </ol>
  );
}
