import { cn } from "@/shared/lib/utils";

interface CapacityGaugeProps {
  used: number;
  capacity: number;
  label?: string;
  className?: string;
}

/** Jauge d'occupation : vert < 70 %, ambre < 90 %, rouge ensuite. Le % est toujours écrit (pas seulement la couleur). */
export function CapacityGauge({ used, capacity, label, className }: CapacityGaugeProps) {
  const pct = capacity > 0 ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const color = pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-amber-brand" : "bg-success";
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        {label && <span className="font-medium">{label}</span>}
        <span className="text-muted-foreground">
          {used}/{capacity} · {pct} %
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={label ?? "Capacité"}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
