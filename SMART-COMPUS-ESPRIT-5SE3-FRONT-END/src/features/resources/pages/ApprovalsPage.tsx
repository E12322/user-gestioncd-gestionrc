import { useMemo, useState } from "react";
import { Check, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { decideReservation } from "../api";
import { useReservations, useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { Reservation, ReservationStatus } from "../types";

type Decision = { reservation: Reservation; status: "confirmed" | "refused" };
type Conflict = { reservation: Reservation; message: string; conflicts: string[] };

/** Administrateur : file de validation des réservations (En attente → Confirmé / Refusé), avec détection de conflit à la confirmation. */
export default function ApprovalsPage() {
  const t = useT();
  const viewer = useViewer();
  const query = useReservations("all");
  const [status, setStatus] = useState<ReservationStatus | "">("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [conflict, setConflict] = useState<Conflict>();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!decision) return;
    const { reservation, status: next } = decision;
    setBusy(true);
    setConflict(undefined);
    try {
      await decideReservation(reservation.id, next, viewer);
      toast.success(t(`resources.approvals.done.${next}`, { room: reservation.roomName, name: reservation.requesterName }));
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setConflict({ reservation, message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      } else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setDecision(null);
      setBusy(false);
      query.refetch();
    }
  }

  const columns = useMemo<Column<Reservation>[]>(
    () => [
      {
        key: "requester",
        header: t("resources.col.requester"),
        sortValue: (r) => r.requesterName,
        cell: (r) => <span className="font-medium">{r.requesterName}</span>,
      },
      {
        key: "room",
        header: t("resources.col.room"),
        sortValue: (r) => r.roomName,
        cell: (r) => (
          <div>
            <p className="font-medium">{r.roomName}</p>
            <p className="text-xs text-muted-foreground">{r.purpose}</p>
          </div>
        ),
      },
      {
        key: "slot",
        header: t("resources.col.slot"),
        sortValue: (r) => `${r.date} ${r.start}`,
        cell: (r) => (
          <div>
            <p className="capitalize">{formatDay(r.date)}</p>
            <p className="text-xs text-muted-foreground">
              {r.start}–{r.end}
            </p>
          </div>
        ),
      },
      { key: "date", header: t("resources.col.requested"), sortValue: (r) => r.requestedAt, cell: (r) => formatDateTime(r.requestedAt) },
      { key: "status", header: t("resources.col.status"), sortValue: (r) => r.status, cell: (r) => <StatusPill status={r.status} /> },
      {
        key: "actions",
        header: t("resources.col.actions"),
        cell: (r) =>
          r.status === "pending" ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("resources.approvals.confirm")} — ${r.requesterName}, ${r.roomName}`}
                title={t("resources.approvals.confirm")}
                className="text-green-800 hover:bg-green-50"
                onClick={() => setDecision({ reservation: r, status: "confirmed" })}
              >
                <Check aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("resources.approvals.refuse")} — ${r.requesterName}, ${r.roomName}`}
                title={t("resources.approvals.refuse")}
                className="text-red-700 hover:bg-red-50"
                onClick={() => setDecision({ reservation: r, status: "refused" })}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{r.decidedAt ? formatDateTime(r.decidedAt) : "—"}</span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      {conflict && (
        <ConflictAlert
          title={t("resources.approvals.conflictTitle")}
          description={`${conflict.message}. ${t("resources.approvals.conflictHint")}`}
          conflicts={conflict.conflicts}
          action={
            <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
              {t("common.close")}
            </button>
          }
        />
      )}

      <QueryBoundary query={query} moduleName={t("module.resources")}>
        {(all) => {
          const count = (s: ReservationStatus) => all.filter((r) => r.status === s).length;
          const rows = status ? all.filter((r) => r.status === status) : all;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("status.pending")} value={count("pending")} icon={ClipboardList} tone="amber" />
                <StatCard label={t("status.confirmed")} value={count("confirmed")} icon={Check} tone="green" />
                <StatCard label={t("status.refused")} value={count("refused")} icon={X} tone="red" />
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="approvals-status" className="sr-only">
                  {t("resources.approvals.filter")}
                </label>
                <Select id="approvals-status" value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus | "")}>
                  <option value="">{t("resources.approvals.allStatuses")}</option>
                  {(["pending", "confirmed", "refused"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {all.length === 0 ? (
                <Card>
                  <EmptyState icon={ClipboardList} title={t("resources.approvals.empty")} />
                </Card>
              ) : (
                <DataTable
                  caption={t("resources.approvals.caption")}
                  columns={columns}
                  data={rows}
                  rowKey={(r) => r.id}
                  emptyTitle={t("resources.approvals.noMatch")}
                />
              )}
            </>
          );
        }}
      </QueryBoundary>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(o) => !o && !busy && setDecision(null)}
        loading={busy}
        destructive={decision?.status === "refused"}
        title={decision ? t(`resources.approvals.confirm.${decision.status}`, { room: decision.reservation.roomName }) : ""}
        description={decision ? t(`resources.approvals.confirmBody.${decision.status}`) : undefined}
        confirmLabel={
          decision ? t(decision.status === "confirmed" ? "resources.approvals.confirm" : "resources.approvals.refuse") : undefined
        }
        onConfirm={confirm}
      />
    </div>
  );
}
