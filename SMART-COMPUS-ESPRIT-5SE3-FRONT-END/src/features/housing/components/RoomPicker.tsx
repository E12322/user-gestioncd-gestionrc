import { BedDouble } from "lucide-react";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { useAvailableRooms } from "../hooks";
import type { RoomType } from "../types";

interface RoomPickerProps {
  residenceId: string;
  type: RoomType;
  value: string;
  onChange: (roomId: string) => void;
}

/** Choix d'une chambre libre (groupe de boutons radio, navigable au clavier). */
export function RoomPicker({ residenceId, type, value, onChange }: RoomPickerProps) {
  const t = useT();
  const query = useAvailableRooms(residenceId, type);
  return (
    <QueryBoundary query={query} moduleName={t("module.housing")}>
      {(rooms) =>
        rooms.length === 0 ? (
          <EmptyState icon={BedDouble} title={t("housing.assign.none")} className="py-6" />
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t("housing.assign.pick")}</legend>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {rooms.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    value === r.id ? "border-navy bg-blue-50" : "bg-card hover:bg-secondary",
                  )}
                >
                  <input type="radio" name="housing-room" className="sr-only" checked={value === r.id} onChange={() => onChange(r.id)} />
                  <span className="font-semibold">{t("housing.room.number", { number: r.number })}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("housing.room.floor", { n: r.floor })} · {t("housing.room.free", { free: r.beds - r.occupants, beds: r.beds })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )
      }
    </QueryBoundary>
  );
}
