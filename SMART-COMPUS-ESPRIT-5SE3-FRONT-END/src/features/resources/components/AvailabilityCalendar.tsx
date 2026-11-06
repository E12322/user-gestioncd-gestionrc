import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { useAvailability } from "../hooks";
import { formatDay, fromMinutes, overlaps } from "../utils/time";
import { CLOSE_HOUR, OPEN_HOUR, type BusySlot } from "../types";

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);

const STATE_STYLE = {
  free: "border-green-200 bg-green-50 text-green-900",
  pending: "border-amber-300 bg-amber-50 text-amber-950",
  confirmed: "border-slate-900 bg-slate-900 text-white",
} as const;

function stateOf(hour: number, slots: BusySlot[]): keyof typeof STATE_STYLE {
  const range = { start: fromMinutes(hour * 60), end: fromMinutes(hour * 60 + 60) };
  const hits = slots.filter((s) => overlaps(s, range));
  if (hits.some((s) => s.status === "confirmed")) return "confirmed";
  return hits.length ? "pending" : "free";
}

/** Occupation d'une salle heure par heure pour une journée (libre / en attente / occupée, toujours écrit en toutes lettres). */
export function AvailabilityCalendar({ roomId, date }: { roomId: string; date: string }) {
  const t = useT();
  const query = useAvailability(roomId, date);
  return (
    <QueryBoundary
      query={query}
      moduleName={t("module.resources")}
      skeleton={
        <div className="space-y-1.5">
          {HOURS.map((h) => (
            <Skeleton key={h} className="h-8 w-full" />
          ))}
        </div>
      }
    >
      {({ slots }) => (
        <div className="space-y-2">
          <p className="text-sm font-medium capitalize">{t("resources.avail.caption", { day: formatDay(date) })}</p>
          {slots.length === 0 && <p className="text-sm text-muted-foreground">{t("resources.avail.empty")}</p>}
          <ol className="space-y-1">
            {HOURS.map((h) => {
              const state = stateOf(h, slots);
              return (
                <li key={h} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{fromMinutes(h * 60)}</span>
                  <span className={cn("flex-1 rounded-md border px-3 py-1 text-xs font-medium", STATE_STYLE[state])}>
                    {t(`resources.avail.${state}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </QueryBoundary>
  );
}
