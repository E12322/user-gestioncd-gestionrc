import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { ContratStatut } from "../types";

const STYLE: Record<ContratStatut, string> = {
  ACTIF: "bg-green-100 text-green-800 border-green-200",
  TERMINE: "bg-slate-100 text-slate-700 border-slate-200",
  RESILIE: "bg-red-100 text-red-800 border-red-200",
};

/** Statut d'un contrat de résidence (Actif / Terminé / Résilié). */
export function ContratStatusBadge({ statut, className }: { statut: ContratStatut; className?: string }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STYLE[statut], className)}>
      {t(`housing.contratStatus.${statut}`)}
    </span>
  );
}
