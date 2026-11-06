import { MapPin } from "lucide-react";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { DAY_LABELS, type Day, type SessionKind, type TimetableEntry } from "../types";

const KIND_STYLE: Record<SessionKind, string> = {
  CM: "border-navy/30 bg-blue-50",
  TD: "border-amber-400/60 bg-amber-50",
  TP: "border-green-600/30 bg-green-50",
};

const DAYS: Day[] = [1, 2, 3, 4, 5, 6];

/** Semaine type : une colonne par jour (liste empilée sur mobile), séances triées par heure. */
export function TimetableGrid({ entries }: { entries: TimetableEntry[] }) {
  const t = useT();
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {DAYS.map((day) => {
        const list = entries.filter((e) => e.day === day);
        return (
          <section key={day} aria-labelledby={`day-${day}`} className="min-w-0">
            <h3 id={`day-${day}`} className="mb-2 border-b pb-2 text-sm font-semibold">
              {DAY_LABELS[day]}
            </h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("academic.timetable.free")}</p>
            ) : (
              <ul className="space-y-2">
                {list.map((e) => (
                  <li key={e.id} className={cn("rounded-lg border p-3 text-sm", KIND_STYLE[e.kind])}>
                    <p className="font-semibold">
                      <time>{e.start}</time>–<time>{e.end}</time>
                    </p>
                    <p className="mt-0.5 font-medium">{e.courseCode}</p>
                    <p className="truncate text-muted-foreground" title={e.courseTitle}>
                      {e.courseTitle}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      {e.room} · <abbr title={t(`academic.kind.${e.kind}`)}>{e.kind}</abbr>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
