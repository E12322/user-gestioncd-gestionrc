import { BedDouble, Building2, DoorOpen, Layers, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { Chambre } from "../types";

interface ChambreCardProps {
  chambre: Chambre;
  /** Actions d'administration (création/suppression réservées à l'admin). */
  admin?: boolean;
  busy?: boolean;
  onToggleDisponibilite?: (chambre: Chambre) => void;
  onDelete?: (chambre: Chambre) => void;
}

/** Fiche d'une chambre : numéro, type, bâtiment, étage, capacité et disponibilité. */
export function ChambreCard({ chambre, admin, busy, onToggleDisponibilite, onDelete }: ChambreCardProps) {
  const t = useT();
  return (
    <Card className={cn("flex flex-col gap-3 p-5", !chambre.disponible && "bg-secondary/40")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold leading-snug">{t("housing.rooms.roomLabel", { numero: chambre.numero })}</h3>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`housing.type.${chambre.type}`)}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            chambre.disponible ? "border-green-200 bg-green-100 text-green-800" : "border-slate-200 bg-slate-100 text-slate-700",
          )}
        >
          {chambre.disponible ? t("housing.rooms.available") : t("housing.rooms.occupied")}
        </span>
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          {chambre.batiment}
        </li>
        <li className="flex items-center gap-2">
          <Layers className="size-4 shrink-0" aria-hidden="true" />
          {t("housing.rooms.floor", { n: chambre.etage })}
        </li>
        <li className="flex items-center gap-2">
          <BedDouble className="size-4 shrink-0" aria-hidden="true" />
          {t("housing.rooms.capacity", { count: chambre.capacite })}
        </li>
      </ul>

      {admin && (
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onToggleDisponibilite?.(chambre)}>
            <DoorOpen aria-hidden="true" />
            {chambre.disponible ? t("housing.rooms.makeOccupied") : t("housing.rooms.makeFree")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            className="text-red-700 hover:bg-red-50"
            aria-label={`${t("housing.rooms.delete")} — ${t("housing.rooms.roomLabel", { numero: chambre.numero })}`}
            title={t("housing.rooms.delete")}
            onClick={() => onDelete?.(chambre)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      )}
    </Card>
  );
}
