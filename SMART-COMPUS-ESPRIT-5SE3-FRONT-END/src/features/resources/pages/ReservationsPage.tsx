import { CalendarPlus, CalendarX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { Timeline, type TimelineItem } from "@/shared/components/common/Timeline";
import { useT, type TFunction } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { useReservations } from "../hooks";
import { formatDay } from "../utils/time";
import type { Reservation } from "../types";

function trackingItems(r: Reservation, t: TFunction): TimelineItem[] {
  const items: TimelineItem[] = [
    { id: "requested", title: t("resources.timeline.requested"), date: formatDateTime(r.requestedAt), tone: "navy" },
  ];
  if (r.status === "pending") items.push({ id: "waiting", title: t("resources.timeline.waiting"), date: "", tone: "amber" });
  else
    items.push({
      id: r.status,
      title: t(`resources.timeline.${r.status}`),
      date: r.decidedAt ? formatDateTime(r.decidedAt) : "",
      tone: r.status === "confirmed" ? "green" : "red",
    });
  return items;
}

/** Mes réservations, de la plus récente à la plus ancienne, avec le suivi de statut de chaque demande. */
export default function ReservationsPage() {
  const t = useT();
  const query = useReservations("mine");
  return (
    <QueryBoundary
      query={query}
      moduleName={t("module.resources")}
      skeleton={
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      }
    >
      {(list) =>
        list.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarX}
              title={t("resources.mine.empty")}
              action={
                <Button asChild>
                  <Link to="/ressources/reserver">{t("resources.mine.emptyAction")}</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("resources.mine.count", { count: list.length })}
              </p>
              <Button asChild size="sm">
                <Link to="/ressources/reserver">
                  <CalendarPlus aria-hidden="true" />
                  {t("resources.mine.new")}
                </Link>
              </Button>
            </div>
            <ul className="space-y-3">
              {list.map((r) => (
                <li key={r.id}>
                  <Card className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">
                          {r.roomName} <span className="text-sm font-normal text-muted-foreground">· {r.building}</span>
                        </h3>
                        <p className="text-sm capitalize">
                          {formatDay(r.date)} · {r.start}–{r.end}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {r.purpose} · {t("resources.mine.attendees", { count: r.attendees })}
                        </p>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                    <details>
                      <summary className="cursor-pointer rounded text-sm font-medium text-navy underline-offset-4 hover:underline">
                        {t("resources.mine.track")}
                      </summary>
                      <Timeline className="mt-4" items={trackingItems(r, t)} />
                    </details>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    </QueryBoundary>
  );
}
