import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

export interface BatimentOccupancyRow {
  name: string;
  occupied: number;
  total: number;
}

/** Occupation des chambres par bâtiment : barres horizontales, valeurs toujours écrites. */
export function BatimentOccupancy({ rows }: { rows: BatimentOccupancyRow[] }) {
  const t = useT();
  const used = rows.reduce((n, r) => n + r.occupied, 0);
  const total = rows.reduce((n, r) => n + r.total, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("housing.dash.occupancy")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("housing.dash.occupancyTotal", { used, total })}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = r.total ? Math.round((r.occupied / r.total) * 100) : 0;
            return (
              <li key={r.name} aria-label={t("housing.dash.occupancyRow", { name: r.name, used: r.occupied, total: r.total, pct })}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm" aria-hidden="true">
                  <span className="truncate font-medium">{r.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {r.occupied}/{r.total} · {pct} %
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
