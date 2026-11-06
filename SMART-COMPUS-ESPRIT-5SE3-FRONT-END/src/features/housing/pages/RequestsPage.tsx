import { useMemo, useState } from "react";
import { BedDouble, Check, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
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
import { assignRoom, refuseRequest } from "../api";
import { RoomPicker } from "../components/RoomPicker";
import { useRequests, useResidences, useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { HousingRequest, RequestStatus } from "../types";

type Conflict = { message: string; conflicts: string[] };
const conflictOf = (e: unknown): Conflict | undefined =>
  isApiError(e) && e.isConflict
    ? { message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] }
    : undefined;

/** Administrateur : file des demandes d'hébergement, affectation d'une chambre (ChambreAffectée) ou refus. */
export default function RequestsPage() {
  const t = useT();
  const viewer = useViewer();
  const query = useRequests();
  const residences = useResidences();
  const [status, setStatus] = useState<RequestStatus | "">("");

  const [assigning, setAssigning] = useState<HousingRequest | null>(null);
  const [residenceId, setResidenceId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [assignError, setAssignError] = useState<string>();
  const [refusing, setRefusing] = useState<HousingRequest | null>(null);
  const [conflict, setConflict] = useState<Conflict>();
  const [busy, setBusy] = useState(false);

  const fullIds = new Set((residences.data ?? []).filter((r) => r.occupied >= r.capacity).map((r) => r.id));

  function openAssign(r: HousingRequest) {
    setAssigning(r);
    setResidenceId(r.residenceId);
    setRoomId("");
    setAssignError(undefined);
    setConflict(undefined);
  }

  async function assign() {
    if (!assigning) return;
    if (!roomId) return setAssignError(t("housing.assign.choose"));
    setBusy(true);
    try {
      await assignRoom(assigning.id, roomId, viewer);
      toast.success(t("housing.requests.assigned", { number: roomId.split("-")[1] ?? "", name: assigning.studentName }));
      setAssigning(null);
    } catch (e) {
      const c = conflictOf(e);
      if (c) {
        setConflict(c);
        setAssigning(null);
      } else toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      query.refetch();
      residences.refetch();
    }
  }

  async function refuse() {
    if (!refusing) return;
    setBusy(true);
    try {
      await refuseRequest(refusing.id, viewer);
      toast.success(t("housing.requests.refused", { name: refusing.studentName }));
    } catch (e) {
      const c = conflictOf(e);
      if (c) setConflict(c);
      else toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setRefusing(null);
      setBusy(false);
      query.refetch();
    }
  }

  const columns = useMemo<Column<HousingRequest>[]>(
    () => [
      {
        key: "student",
        header: t("housing.col.student"),
        sortValue: (r) => r.studentName,
        cell: (r) => <span className="font-medium">{r.studentName}</span>,
      },
      {
        key: "request",
        header: t("housing.col.request"),
        sortValue: (r) => r.residenceName,
        cell: (r) => (
          <div>
            <p className="font-medium">{r.assignedRoomNumber ? `${r.assignedResidenceName} · ${r.assignedRoomNumber}` : r.residenceName}</p>
            <p className="text-xs text-muted-foreground">
              {t(`housing.roomType.${r.roomType}`)}
              {r.accessibility && ` · ${t("housing.requests.accessibility")}`}
            </p>
            {r.status === "pending" && fullIds.has(r.residenceId) && (
              <p className="mt-0.5 text-xs font-semibold text-red-800">{t("housing.requests.fullBadge")}</p>
            )}
          </div>
        ),
      },
      { key: "entry", header: t("housing.col.entry"), sortValue: (r) => r.entryDate, cell: (r) => formatDay(r.entryDate) },
      { key: "date", header: t("housing.col.requested"), sortValue: (r) => r.requestedAt, cell: (r) => formatDateTime(r.requestedAt) },
      { key: "status", header: t("housing.col.status"), sortValue: (r) => r.status, cell: (r) => <StatusPill status={r.status} /> },
      {
        key: "actions",
        header: t("housing.col.actions"),
        cell: (r) =>
          r.status === "pending" ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("housing.requests.assign")} — ${r.studentName}`}
                title={t("housing.requests.assign")}
                className="text-green-800 hover:bg-green-50"
                onClick={() => openAssign(r)}
              >
                <BedDouble aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("housing.requests.refuse")} — ${r.studentName}`}
                title={t("housing.requests.refuse")}
                className="text-red-700 hover:bg-red-50"
                onClick={() => setRefusing(r)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{r.decidedAt ? formatDateTime(r.decidedAt) : "—"}</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, residences.data],
  );

  return (
    <div className="space-y-6">
      {conflict && (
        <ConflictAlert
          title={t("housing.requests.conflictTitle")}
          description={`${conflict.message}. ${t("housing.requests.conflictHint")}`}
          conflicts={conflict.conflicts}
          action={
            <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
              {t("common.close")}
            </button>
          }
        />
      )}

      <QueryBoundary query={query} moduleName={t("module.housing")}>
        {(all) => {
          const count = (s: RequestStatus) => all.filter((r) => r.status === s).length;
          const rows = status ? all.filter((r) => r.status === status) : all;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("status.pending")} value={count("pending")} icon={ClipboardList} tone="amber" />
                <StatCard label={t("status.confirmed")} value={count("confirmed")} icon={Check} tone="green" />
                <StatCard label={t("status.refused")} value={count("refused")} icon={X} tone="red" />
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="housing-status" className="sr-only">
                  {t("housing.requests.filter")}
                </label>
                <Select id="housing-status" value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")}>
                  <option value="">{t("housing.requests.allStatuses")}</option>
                  {(["pending", "confirmed", "refused"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {all.length === 0 ? (
                <Card>
                  <EmptyState icon={ClipboardList} title={t("housing.requests.empty")} />
                </Card>
              ) : (
                <DataTable
                  caption={t("housing.requests.caption")}
                  columns={columns}
                  data={rows}
                  rowKey={(r) => r.id}
                  emptyTitle={t("housing.requests.noMatch")}
                />
              )}
            </>
          );
        }}
      </QueryBoundary>

      <Dialog open={assigning !== null} onOpenChange={(o) => !o && !busy && setAssigning(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {assigning && (
            <>
              <DialogTitle>{t("housing.assign.title", { name: assigning.studentName })}</DialogTitle>
              <DialogDescription>
                {t("housing.assign.description", {
                  type: t(`housing.roomType.${assigning.roomType}`).toLowerCase(),
                  residence: assigning.residenceName,
                })}
              </DialogDescription>
              <div className="space-y-1.5">
                <label htmlFor="assign-residence" className="text-sm font-medium">
                  {t("housing.assign.residence")}
                </label>
                <Select
                  id="assign-residence"
                  value={residenceId}
                  onChange={(e) => {
                    setResidenceId(e.target.value);
                    setRoomId("");
                    setAssignError(undefined);
                  }}
                >
                  {(residences.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.occupied}/{r.capacity})
                    </option>
                  ))}
                </Select>
              </div>
              <RoomPicker
                residenceId={residenceId}
                type={assigning.roomType}
                value={roomId}
                onChange={(id) => {
                  setRoomId(id);
                  setAssignError(undefined);
                }}
              />
              {assignError && (
                <p role="alert" className="text-sm text-red-700">
                  {assignError}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" disabled={busy} onClick={() => setAssigning(null)}>
                  {t("common.cancel")}
                </Button>
                <Button disabled={busy} onClick={() => void assign()}>
                  {t("housing.assign.confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={refusing !== null}
        onOpenChange={(o) => !o && !busy && setRefusing(null)}
        loading={busy}
        destructive
        title={refusing ? t("housing.requests.refuseTitle", { name: refusing.studentName }) : ""}
        description={t("housing.requests.refuseBody")}
        confirmLabel={t("housing.requests.refuse")}
        onConfirm={refuse}
      />
    </div>
  );
}
