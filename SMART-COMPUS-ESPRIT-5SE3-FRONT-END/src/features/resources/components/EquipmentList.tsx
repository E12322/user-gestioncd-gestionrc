import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { Equipment } from "../types";

/** Équipements d'une salle, en texte simple (l'information ne repose ni sur la couleur ni sur une icône). */
export function EquipmentList({ equipment, className }: { equipment: Equipment[]; className?: string }) {
  const t = useT();
  if (equipment.length === 0) return <p className={cn("text-sm text-muted-foreground", className)}>{t("resources.room.noEquipment")}</p>;
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      <span className="sr-only">{t("resources.room.equipment")} : </span>
      {equipment.map((e) => e.label).join(", ")}
    </p>
  );
}
