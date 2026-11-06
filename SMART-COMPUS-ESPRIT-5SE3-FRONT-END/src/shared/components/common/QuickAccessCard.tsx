import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { TONES, type Tone } from "@/shared/lib/tones";
import { cn } from "@/shared/lib/utils";

interface QuickAccessCardProps {
  to: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone: Tone;
}

export function QuickAccessCard({ to, title, description, icon: Icon, tone }: QuickAccessCardProps) {
  return (
    <Link
      to={to}
      className={cn("group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-secondary", TONES[tone].ring)}
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="block font-medium underline-offset-4 group-hover:underline">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>}
      </span>
    </Link>
  );
}
