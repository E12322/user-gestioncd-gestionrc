import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n";
import type { MessageKey } from "@/shared/i18n/fr";

export type Status = "pending" | "validated" | "confirmed" | "refused";

const STYLES: Record<Status, { label: MessageKey; cls: string }> = {
  pending: { label: "status.pending", cls: "bg-slate-100 text-slate-700 border-slate-200" }, // gris
  validated: { label: "status.validated", cls: "bg-slate-900 text-white border-slate-900" }, // noir
  confirmed: { label: "status.confirmed", cls: "bg-green-100 text-green-800 border-green-200" }, // vert
  refused: { label: "status.refused", cls: "bg-red-100 text-red-800 border-red-200" }, // rouge
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const t = useT();
  const s = STYLES[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", s.cls, className)}>
      {t(s.label)}
    </span>
  );
}
