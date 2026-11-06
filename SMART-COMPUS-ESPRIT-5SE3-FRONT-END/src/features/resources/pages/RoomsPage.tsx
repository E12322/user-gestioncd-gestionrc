import { useEffect, useState } from "react";
import { DoorOpen, Search } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
import { EquipmentList } from "../components/EquipmentList";
import { RoomCard } from "../components/RoomCard";
import { useRooms } from "../hooks";
import { BUILDINGS, CAPACITY_STEPS } from "../mocks";
import { addDays, todayISO } from "../utils/time";
import type { RoomView } from "../types";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";

export default function RoomsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [building, setBuilding] = useState("");
  const [minCapacity, setMinCapacity] = useState(0);
  const [selected, setSelected] = useState<RoomView>();
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useRooms({ q, building, minCapacity });
  const filtered = Boolean(q || building || minCapacity);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="room-search" className="sr-only">
            {t("resources.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="room-search"
              type="search"
              className="pl-9"
              placeholder={t("resources.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="room-building" className="sr-only">
            {t("resources.filter.building")}
          </label>
          <Select id="room-building" value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">{t("resources.filter.allBuildings")}</option>
            {BUILDINGS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="room-capacity" className="sr-only">
            {t("resources.filter.capacity")}
          </label>
          <Select id="room-capacity" value={minCapacity} onChange={(e) => setMinCapacity(Number(e.target.value))}>
            {CAPACITY_STEPS.map((c) => (
              <option key={c} value={c}>
                {c === 0 ? t("resources.filter.anyCapacity") : t("resources.filter.minCapacity", { count: c })}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <QueryBoundary query={query} moduleName={t("module.resources")} skeleton={<CatalogListSkeleton count={6} />}>
        {(rooms) =>
          rooms.length === 0 ? (
            <Card>
              <EmptyState icon={DoorOpen} title={filtered ? t("resources.empty.noMatch") : t("resources.empty.rooms")} />
            </Card>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("resources.rooms.count", { count: rooms.length })}
              </p>
              <CatalogList>
                {rooms.map((r) => (
                  <RoomCard
                    key={r.id}
                    room={r}
                    onShowAvailability={(x) => {
                      setDate(todayISO());
                      setSelected(x);
                    }}
                  />
                ))}
              </CatalogList>
            </>
          )
        }
      </QueryBoundary>

      <Dialog open={selected !== undefined} onOpenChange={(o) => !o && setSelected(undefined)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selected && (
            <>
              <DialogTitle>{t("resources.avail.title", { room: selected.name })}</DialogTitle>
              <DialogDescription>{t("resources.avail.description")}</DialogDescription>
              <EquipmentList equipment={selected.equipment} />
              <div className="max-w-[12rem] space-y-1.5">
                <label htmlFor="avail-date" className="text-sm font-medium">
                  {t("resources.avail.date")}
                </label>
                <Input
                  id="avail-date"
                  type="date"
                  min={todayISO()}
                  max={addDays(180)}
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                />
              </div>
              <AvailabilityCalendar roomId={selected.id} date={date} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
