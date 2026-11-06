import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { Residence } from "../types";

/** Occupation par résidence : barres horizontales, valeurs toujours écrites (pas seulement la couleur). */
export function OccupancyChart({ residences }: { residences: Residence[] }) {
  const t = useT();
  const used = residences.reduce((n, r) => n + r.occupied, 0);
  const capacity = residences.reduce((n, r) => n + r.capacity, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("housing.chart.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("housing.chart.total", { used, capacity })}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {residences.map((r) => {
            const pct = r.capacity ? Math.round((r.occupied / r.capacity) * 100) : 0;
            return (
              <li key={r.id} aria-label={t("housing.chart.row", { name: r.name, used: r.occupied, capacity: r.capacity, pct })}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm" aria-hidden="true">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {r.occupied}/{r.capacity} · {pct} %
                  </span>
                </div>
                <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn("h-full rounded-full", pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-amber-brand" : "bg-success")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
