import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { DemandeStatut } from "../types";

const STYLE: Record<DemandeStatut, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-900 border-amber-200",
  APPROUVEE: "bg-green-100 text-green-800 border-green-200",
  REFUSEE: "bg-red-100 text-red-800 border-red-200",
  ANNULEE: "bg-slate-100 text-slate-700 border-slate-200",
};

/** Statut d'une demande d'hébergement (En attente / Approuvée / Refusée / Annulée). */
export function DemandeStatusBadge({ statut, className }: { statut: DemandeStatut; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STYLE[statut], className)}>
      {t(`housing.demandeStatus.${statut}`)}
    </span>
  );
}
