import { useState } from "react";
import { CalendarX } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { toast } from "sonner";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { EventCard } from "../components/EventCard";
import { registerForEvent, unregisterFromEvent } from "../api";
import { useClubs, useEvents, useMyRegistrations, useViewer } from "../hooks";
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
  const { role } = useAuth();
  const viewer = useViewer();
  const registrations = useMyRegistrations();
  const isRegistered = (eventId: string) =>
    registrations.data?.some((r) => r.eventId === eventId) ?? false;

  async function toggleRegister(eventId: string, title: string) {
    try {
      if (isRegistered(eventId)) {
        await unregisterFromEvent(eventId, viewer);
        toast.success(t("life.event.unregisterSuccess", { title }));
      } else {
        await registerForEvent(eventId, viewer);
        toast.success(t("life.event.registerSuccess", { title }));
      }
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      registrations.refetch();
    }
  }

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
                      <EventCard key={e.id} event={e}>
                        {role !== "admin" && (
                          <Button
                            variant={isRegistered(e.id) ? "outline" : "default"}
                            size="sm"
                            className="mt-2"
                            onClick={() => void toggleRegister(e.id, e.title)}
                          >
                            {isRegistered(e.id) ? t("life.event.registered") : t("life.event.register")}
                          </Button>
                        )}
                      </EventCard>
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
