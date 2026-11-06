import type { LucideIcon } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { TONES, type Tone } from "@/shared/lib/tones";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue", className }: StatCardProps) {
  return (
    <Card className={cn("flex items-center gap-4 p-5", className)}>
      {Icon && <Icon className={cn("size-5 shrink-0", TONES[tone].text)} aria-hidden="true" />}
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="tabular text-2xl font-semibold leading-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}
