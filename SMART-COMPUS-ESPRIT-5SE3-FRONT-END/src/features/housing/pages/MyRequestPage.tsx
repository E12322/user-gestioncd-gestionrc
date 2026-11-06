import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { Timeline, type TimelineItem } from "@/shared/components/common/Timeline";
import { isApiError } from "@/shared/api/errors";
import { useT, type TFunction } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { cancelRequest } from "../api";
import { HousingRequestStepper } from "../components/HousingRequestStepper";
import { useMyRequest, useResidences, useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { HousingRequest } from "../types";

function trackingItems(r: HousingRequest, t: TFunction): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: "requested",
      title: t("housing.timeline.requested"),
      description: r.residenceName,
      date: formatDateTime(r.requestedAt),
      tone: "navy",
    },
  ];
  if (r.status === "pending") items.push({ id: "waiting", title: t("housing.timeline.waiting"), date: "", tone: "amber" });
  else {
    items.push({
      id: r.status,
      title: t(`housing.timeline.${r.status}`),
      description:
        r.status === "confirmed"
          ? t("housing.mine.assigned", { number: r.assignedRoomNumber ?? "—", residence: r.assignedResidenceName ?? r.residenceName })
          : undefined,
      date: r.decidedAt ? formatDateTime(r.decidedAt) : "",
      tone: r.status === "confirmed" ? "green" : "red",
    });
  }
  return items;
}

/** Étudiant : dépôt de la demande en 4 étapes, puis suivi (Timeline). Une demande en attente peut être annulée. */
export default function MyRequestPage() {
  const t = useT();
  const viewer = useViewer();
  const [params] = useSearchParams();
  const mine = useMyRequest();
  const residences = useResidences();
  const [retry, setRetry] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel(id: string) {
    setBusy(true);
    try {
      await cancelRequest(id, viewer);
      toast.success(t("housing.mine.cancelled"));
      setRetry(false);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      setAskCancel(false);
      mine.refetch();
    }
  }

  return (
    <QueryBoundary
      query={mine}
      moduleName={t("module.housing")}
      skeleton={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      {(request) => {
        const showForm = !request || (request.status === "refused" && retry);
        if (showForm) {
          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t("housing.mine.newTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("housing.mine.newDescription")}</p>
              </div>
              <QueryBoundary query={residences} moduleName={t("module.housing")}>
                {(list) => (
                  <HousingRequestStepper
                    residences={list}
                    initialResidenceId={params.get("residence") ?? undefined}
                    onDone={() => {
                      setRetry(false);
                      mine.refetch();
                      residences.refetch();
                    }}
                  />
                )}
              </QueryBoundary>
            </div>
          );
        }
        return (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{t("housing.mine.tracking")}</h2>
                <StatusPill status={request.status} />
              </div>
              <Timeline items={trackingItems(request, t)} />
              {request.status === "refused" && <p className="text-sm text-muted-foreground">{t("housing.mine.refusedInfo")}</p>}
              <div className="flex flex-wrap gap-2">
                {request.status === "pending" && (
                  <Button variant="outline" onClick={() => setAskCancel(true)}>
                    {t("housing.mine.cancel")}
                  </Button>
                )}
                {request.status === "refused" && <Button onClick={() => setRetry(true)}>{t("housing.mine.retry")}</Button>}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-lg font-semibold">{t("housing.mine.summary")}</h2>
              <dl className="divide-y rounded-lg border">
                {[
                  [t("housing.step.chosen"), request.residenceName],
                  [t("housing.field.roomType"), t(`housing.roomType.${request.roomType}`)],
                  [t("housing.field.entryDate"), formatDay(request.entryDate)],
                  [t("housing.field.duration"), t("housing.field.durationOption", { count: request.durationMonths })],
                  [t("housing.field.accessibility"), request.accessibility ? t("housing.field.yes") : t("housing.field.no")],
                  [t("housing.field.notes"), request.notes || t("housing.field.none")],
                ].map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[11rem_1fr]">
                    <dt className="font-medium text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <ConfirmDialog
              open={askCancel}
              onOpenChange={(o) => !o && !busy && setAskCancel(false)}
              loading={busy}
              destructive
              title={t("housing.mine.cancelTitle")}
              description={t("housing.mine.cancelBody")}
              confirmLabel={t("housing.mine.cancelConfirm")}
              cancelLabel={t("housing.mine.cancelKeep")}
              onConfirm={() => cancel(request.id)}
            />
          </div>
        );
      }}
    </QueryBoundary>
  );
}
