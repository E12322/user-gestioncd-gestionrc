import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { TicketStatus } from "../types";

const STYLE: Record<TicketStatus, string> = {
  open: "bg-amber-100 text-amber-900 border-amber-200",
  in_progress: "bg-blue-100 text-blue-900 border-blue-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
};

/** Statut d'un signalement de panne (Signalé / En cours / Résolu). */
export function TicketStatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STYLE[status], className)}>
      {t(`housing.ticketStatus.${status}`)}
    </span>
  );
}
