import { useState } from "react";
import { CalendarX } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { EventCard } from "../components/EventCard";
import { useClubs, useEvents } from "../hooks";
import { formatDay } from "../utils/time";
import type { CampusEvent } from "../types";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";

const byDate = (events: CampusEvent[]) => {
  const groups = new Map<string, CampusEvent[]>();
  for (const e of events) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  return [...groups.entries()];
};

/** Agenda du campus : événements à venir, regroupés par jour, filtrables par club. */
export default function EventsPage() {
  const t = useT();
  const [clubId, setClubId] = useState("");
  const clubs = useClubs();
  const query = useEvents({ clubId });

  return (
    <div className="space-y-4">
      <div className="w-full sm:w-64">
        <label htmlFor="event-club" className="sr-only">
          {t("life.events.filter")}
        </label>
        <Select id="event-club" value={clubId} onChange={(e) => setClubId(e.target.value)}>
          <option value="">{t("life.events.allClubs")}</option>
          {(clubs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <QueryBoundary query={query} moduleName={t("module.student-life")} skeleton={<CatalogListSkeleton count={4} />}>
        {(events) =>
          events.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarX} title={t("life.events.empty")} />
            </Card>
          ) : (
            <div className="space-y-6">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("life.events.count", { count: events.length })}
              </p>
              {byDate(events).map(([date, list]) => (
                <section key={date} aria-labelledby={`day-${date}`}>
                  <h2 id={`day-${date}`} className="mb-2 border-b pb-2 text-sm font-semibold capitalize">
                    {formatDay(date)}
                  </h2>
                  <CatalogList>
                    {list.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </CatalogList>
                </section>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
