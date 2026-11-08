import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardList, Info, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { isApiError } from "@/shared/api/errors";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { formatDateTime, formatDate } from "@/shared/lib/format";
import { approveDemande, cancelDemande, refuseDemande } from "../api";
import { ChambrePicker } from "../components/ChambrePicker";
import { DemandeStatusBadge } from "../components/DemandeStatusBadge";
import { useChambres, useChambresDisponibles, useDemandes, useViewer } from "../hooks";
import type { Chambre, Demande, DemandeStatut } from "../types";
import { studentDisplayName } from "../utils/students";

type Conflict = { message: string; conflicts: string[] };
const conflictOf = (e: unknown): Conflict | undefined =>
  isApiError(e) && e.isConflict
    ? { message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] }
    : undefined;

const STATUTS: DemandeStatut[] = ["EN_ATTENTE", "APPROUVEE", "REFUSEE", "ANNULEE"];

/** Étudiant : suivi de ses demandes (annulation possible). Admin : file des demandes, approbation avec choix de chambre ou refus. */
export default function DemandesPage() {
  const t = useT();
  const { role } = useAuth();
  const viewer = useViewer();
  const admin = role === "admin";

  const demandes = useDemandes();
  const chambres = useChambres();
  const disponibles = useChambresDisponibles();

  const [statut, setStatut] = useState<"" | DemandeStatut>("");
  const [approving, setApproving] = useState<Demande | null>(null);
  const [chambreId, setChambreId] = useState("");
  const [assignError, setAssignError] = useState<string>();
  const [refusing, setRefusing] = useState<Demande | null>(null);
  const [cancelling, setCancelling] = useState<Demande | null>(null);
  const [conflict, setConflict] = useState<Conflict>();
  const [busy, setBusy] = useState(false);

  const chambreById = useMemo(() => new Map((chambres.data ?? []).map((c) => [c.id, c])), [chambres.data]);
  const roomLabel = (id: string | null) => {
    if (!id) return "—";
    const chambre = chambreById.get(id);
    return chambre ? t("housing.rooms.roomLabel", { numero: chambre.numero }) : "—";
  };
  const fullRoomLabel = (id: string | null) => {
    const chambre = id ? chambreById.get(id) : undefined;
    return chambre ? `${chambre.numero} · ${chambre.batiment} · ${t(`housing.type.${chambre.type}`)}` : "—";
  };

  /** Vœu de l'étudiant pour le dialogue d'approbation : chambre, encore libre ou non. */
  const wishOf = (demande: Demande | null) => {
    if (!demande?.chambreId) return null;
    const chambre = chambreById.get(demande.chambreId);
    if (!chambre) return null;
    return { chambre, libre: chambre.disponible };
  };

  function openApprove(demande: Demande) {
    setApproving(demande);
    setChambreId(demande.chambreId && chambreById.get(demande.chambreId)?.disponible ? demande.chambreId : "");
    setAssignError(undefined);
    setConflict(undefined);
  }

  async function approve() {
    if (!approving) return;
    if (!chambreId) return setAssignError(t("housing.requests.roomRequired"));
    setBusy(true);
    try {
      const updated = await approveDemande(approving.id, chambreId, viewer);
      toast.success(t("housing.requests.approvedToast", { numero: roomLabel(updated.chambreId) }));
      setApproving(null);
    } catch (e) {
      const c = conflictOf(e);
      if (c) {
        setConflict(c);
        setApproving(null);
      } else toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      demandes.refetch();
      chambres.refetch();
      disponibles.refetch();
    }
  }

  async function refuse() {
    if (!refusing) return;
    setBusy(true);
    try {
      await refuseDemande(refusing.id, viewer);
      toast.success(t("housing.requests.refusedToast"));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      setRefusing(null);
      demandes.refetch();
    }
  }

  async function cancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await cancelDemande(cancelling.id, viewer);
      toast.success(t("housing.requests.cancelled"));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      setCancelling(null);
      demandes.refetch();
      chambres.refetch();
    }
  }

  const columns = useMemo<Column<Demande>[]>(
    () => [
      {
        key: "student",
        header: t("housing.col.student"),
        sortValue: (d) => d.etudiantId,
        cell: (d) => <span className="font-medium">{studentDisplayName(d.etudiantId)}</span>,
      },
      {
        key: "room",
        header: t("housing.col.room"),
        cell: (d) =>
          d.statut === "APPROUVEE"
            ? roomLabel(d.chambreId)
            : d.chambreId
              ? t("housing.requests.wishInTable", { numero: roomLabel(d.chambreId) })
              : "—",
      },
      {
        key: "stay",
        header: t("housing.col.stay"),
        sortValue: (d) => d.dateArrivee,
        cell: (d) => t("housing.requests.stay", { debut: formatDate(d.dateArrivee), fin: formatDate(d.dateDepart) }),
      },
      { key: "deposited", header: t("housing.col.deposited"), sortValue: (d) => d.dateDepot, cell: (d) => formatDateTime(d.dateDepot) },
      { key: "status", header: t("housing.col.status"), sortValue: (d) => d.statut, cell: (d) => <DemandeStatusBadge statut={d.statut} /> },
      {
        key: "actions",
        header: t("housing.col.actions"),
        cell: (d) =>
          d.statut === "EN_ATTENTE" ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("housing.requests.approve")} — ${studentDisplayName(d.etudiantId)}`}
                title={t("housing.requests.approve")}
                className="text-green-800 hover:bg-green-50"
                onClick={() => openApprove(d)}
              >
                <Check aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("housing.requests.refuse")} — ${studentDisplayName(d.etudiantId)}`}
                title={t("housing.requests.refuse")}
                className="text-red-700 hover:bg-red-50"
                onClick={() => setRefusing(d)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{formatDateTime(d.updatedAt ?? d.dateDepot)}</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, chambreById],
  );

  if (!admin) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("housing.requests.mineEmpty")}</h2>
          <Button asChild>
            <Link to="/residences/demandes/new">
              <Plus aria-hidden="true" />
              {t("housing.requests.new")}
            </Link>
          </Button>
        </div>
        <QueryBoundary query={demandes} moduleName={t("module.housing")} skeleton={<Skeleton className="h-40 rounded-xl" />}>
          {(list) => {
            const chambreOf = (c: string | null) => {
              if (!c) return undefined;
              return chambres.data?.find((x) => x.id === c);
            };
            return list.length === 0 ? (
              <Card>
                <EmptyState
                  icon={ClipboardList}
                  title={t("housing.requests.mineEmpty")}
                  action={
                    <Button asChild>
                      <Link to="/residences/demandes/new">{t("housing.dash.create")}</Link>
                    </Button>
                  }
                />
              </Card>
            ) : (
              <ul className="space-y-4">
                {list.map((d) => {
                  const chambre: Chambre | undefined = chambreOf(d.chambreId);
                  return (
                    <li key={d.id}>
                      <Card className="space-y-3 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {t("housing.requests.stay", { debut: formatDate(d.dateArrivee), fin: formatDate(d.dateDepart) })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("housing.requests.depositedOn", { date: formatDateTime(d.dateDepot) })}
                            </p>
                          </div>
                          <DemandeStatusBadge statut={d.statut} />
                        </div>
                        {chambre && (
                          <p className="text-sm">
                            {t("housing.contracts.room", {
                              type: t(`housing.type.${chambre.type}`),
                              numero: chambre.numero,
                              batiment: chambre.batiment,
                            })}
                          </p>
                        )}
                        {(d.statut === "EN_ATTENTE" || d.statut === "APPROUVEE") && (
                          <Button variant="outline" size="sm" onClick={() => setCancelling(d)}>
                            {t("housing.requests.cancel")}
                          </Button>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </QueryBoundary>

        <ConfirmDialog
          open={cancelling !== null}
          onOpenChange={(o) => !o && !busy && setCancelling(null)}
          loading={busy}
          destructive
          title={t("housing.requests.cancelTitle")}
          description={t("housing.requests.cancelBody")}
          confirmLabel={t("housing.requests.cancelConfirm")}
          cancelLabel={t("housing.requests.cancelKeep")}
          onConfirm={cancel}
        />
      </div>
    );
  }

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

      <QueryBoundary query={demandes} moduleName={t("module.housing")}>
        {(all) => {
          const count = (s: DemandeStatut) => all.filter((d) => d.statut === s).length;
          const rows = statut ? all.filter((d) => d.statut === statut) : all;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("housing.demandeStatus.EN_ATTENTE")} value={count("EN_ATTENTE")} icon={ClipboardList} tone="amber" />
                <StatCard label={t("housing.demandeStatus.APPROUVEE")} value={count("APPROUVEE")} icon={Check} tone="green" />
                <StatCard label={t("housing.demandeStatus.REFUSEE")} value={count("REFUSEE")} icon={X} tone="red" />
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="housing-status" className="sr-only">
                  {t("housing.requests.filter")}
                </label>
                <Select id="housing-status" value={statut} onChange={(e) => setStatut(e.target.value as "" | DemandeStatut)}>
                  <option value="">{t("housing.requests.allStatuses")}</option>
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`housing.demandeStatus.${s}`)}
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
                  rowKey={(d) => d.id}
                  emptyTitle={t("housing.requests.noMatch")}
                />
              )}
            </>
          );
        }}
      </QueryBoundary>

      <Dialog open={approving !== null} onOpenChange={(o) => !o && !busy && setApproving(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {approving &&
            (() => {
              const wish = wishOf(approving);
              return (
                <>
                  <DialogTitle>{t("housing.requests.assignTitle", { name: studentDisplayName(approving.etudiantId) })}</DialogTitle>
                  <DialogDescription>{t("housing.requests.assignDescription")}</DialogDescription>
                  {wish ? (
                    wish.libre ? (
                      <p className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {t("housing.requests.wishedRoom", { label: fullRoomLabel(approving.chambreId) })}
                      </p>
                    ) : (
                      <p
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {t("housing.requests.wishedRoomTaken", { label: fullRoomLabel(approving.chambreId) })}
                      </p>
                    )
                  ) : (
                    <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {t("housing.requests.noWish")}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="assign-room" className="text-sm font-medium">
                      {t("housing.col.room")}
                    </label>
                    {(disponibles.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("housing.requests.noRooms")}</p>
                    ) : (
                      <ChambrePicker
                        id="assign-room"
                        chambres={disponibles.data ?? []}
                        value={chambreId}
                        invalid={Boolean(assignError)}
                        onChange={(id) => {
                          setChambreId(id);
                          setAssignError(undefined);
                        }}
                      />
                    )}
                  </div>
                  {assignError && (
                    <p role="alert" className="text-sm text-red-700">
                      {assignError}
                    </p>
                  )}
                  <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={() => setApproving(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button disabled={busy || (disponibles.data ?? []).length === 0} onClick={() => void approve()}>
                      {t("housing.requests.approve")}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={refusing !== null}
        onOpenChange={(o) => !o && !busy && setRefusing(null)}
        loading={busy}
        destructive
        title={refusing ? t("housing.requests.refuseTitle", { name: studentDisplayName(refusing.etudiantId) }) : ""}
        description={t("housing.requests.refuseBody")}
        confirmLabel={t("housing.requests.refuse")}
        onConfirm={refuse}
      />
    </div>
  );
}
