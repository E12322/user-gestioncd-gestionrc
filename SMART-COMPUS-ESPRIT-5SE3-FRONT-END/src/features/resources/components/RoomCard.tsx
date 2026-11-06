import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { CatalogRow } from "@/shared/components/common/CatalogRow";
import { useT } from "@/shared/i18n";
import type { RoomView } from "../types";
import { EquipmentList } from "./EquipmentList";

interface RoomCardProps {
  room: RoomView;
  onShowAvailability: (room: RoomView) => void;
}

/** Ligne du catalogue des salles : lieu, capacité, équipements, occupation du jour et actions. */
export function RoomCard({ room, onShowAvailability }: RoomCardProps) {
  const t = useT();
  const floor = room.floor === 0 ? t("resources.room.ground") : t("resources.room.floor", { n: room.floor });
  return (
    <CatalogRow
      title={room.name}
      meta={[t(`resources.kind.${room.kind}`), room.building, floor, t("resources.room.capacity", { count: room.capacity })]}
      extra={<EquipmentList equipment={room.equipment} />}
      gauge={<CapacityGauge used={room.bookedHoursToday} capacity={room.openHours} label={t("resources.room.occupancy")} />}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowAvailability(room)}
            aria-label={`${t("resources.room.availability")} — ${room.name}`}
          >
            {t("resources.room.availability")}
          </Button>
          <Button size="sm" asChild>
            <Link to={`/ressources/reserver?salle=${room.id}`} aria-label={`${t("resources.room.reserve")} — ${room.name}`}>
              {t("resources.room.reserve")}
            </Link>
          </Button>
        </>
      }
    />
  );
}
