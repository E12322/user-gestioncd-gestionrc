import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, Check, ClipboardList, FileText, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Select } from "@/shared/components/ui/select";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { isApiError } from "@/shared/api/errors";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { decideMembership, deleteClub, deleteEvent } from "../api";
import { ClubForm } from "../components/ClubForm";
import { EventForm } from "../components/EventForm";
import { useClubs, useMemberships, useViewer } from "../hooks";
import type { Membership, MembershipStatus } from "../types";

type Decision = { membership: Membership; status: "confirmed" | "refused" };
type Conflict = { message: string; conflicts: string[] };

/** Administrateur : créer des clubs et des événements, valider les demandes d'adhésion, supprimer clubs et événements, générer rapports. */
export default function ClubAdminPage() {
  const t = useT();
  const viewer = useViewer();
  const query = useMemberships();
  const clubs = useClubs();
  const [status, setStatus] = useState<MembershipStatus | "">("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [conflict, setConflict] = useState<Conflict>();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"club" | "event" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "club" | "event"; id: string; name: string } | null>(null);

  async function confirm() {
    if (!decision) return;
    const { membership, status: next } = decision;
    setBusy(true);
    setConflict(undefined);
    try {
      await decideMembership(membership.id, next, viewer);
      toast.success(t(`life.admin.done.${next}`, { name: membership.memberName, club: membership.clubName }));
    } catch (e) {
      if (isApiError(e) && e.isConflict)
        setConflict({ message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setDecision(null);
      setBusy(false);
      query.refetch();
      clubs.refetch();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget.type === "club") {
        await deleteClub(deleteTarget.id, viewer);
        toast.success(t("life.admin.clubDeleted", { name: deleteTarget.name }));
      } else {
        await deleteEvent(deleteTarget.id, viewer);
        toast.success(t("life.admin.eventDeleted", { title: deleteTarget.name }));
      }
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setDeleteTarget(null);
      setBusy(false);
      query.refetch();
      clubs.refetch();
    }
  }

  const columns = useMemo<Column<Membership>[]>(
    () => [
      {
        key: "member",
        header: t("life.col.member"),
        sortValue: (m) => m.memberName,
        cell: (m) => <span className="font-medium">{m.memberName}</span>,
      },
      { key: "profile", header: t("life.col.profile"), sortValue: (m) => m.memberRole, cell: (m) => t(ROLE_LABEL[m.memberRole]) },
      { key: "club", header: t("life.col.club"), sortValue: (m) => m.clubName, cell: (m) => m.clubName },
      { key: "date", header: t("life.col.requested"), sortValue: (m) => m.requestedAt, cell: (m) => formatDateTime(m.requestedAt) },
      { key: "status", header: t("life.col.status"), sortValue: (m) => m.status, cell: (m) => <StatusPill status={m.status} /> },
      {
        key: "actions",
        header: t("life.col.actions"),
        cell: (m) =>
          m.status === "pending" ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("life.admin.confirm")} — ${m.memberName}, ${m.clubName}`}
                title={t("life.admin.confirm")}
                className="text-green-800 hover:bg-green-50"
                onClick={() => setDecision({ membership: m, status: "confirmed" })}
              >
                <Check aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${t("life.admin.refuse")} — ${m.memberName}, ${m.clubName}`}
                title={t("life.admin.refuse")}
                className="text-red-700 hover:bg-red-50"
                onClick={() => setDecision({ membership: m, status: "refused" })}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{m.decidedAt ? formatDateTime(m.decidedAt) : "—"}</span>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDialog("club")}>
          <Plus aria-hidden="true" />
          {t("life.admin.newClub")}
        </Button>
        <Button variant="outline" onClick={() => setDialog("event")}>
          <CalendarPlus aria-hidden="true" />
          {t("life.admin.newEvent")}
        </Button>
      </div>

      {/* Liste des clubs avec actions admin (suppression, rapport, membres) */}
      <QueryBoundary query={clubs} moduleName={t("module.student-life")}>
        {(clubList) =>
          clubList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("life.tab.clubs")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clubList.map((c) => (
                  <Card key={c.id} className="flex flex-col justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">{c.category}</p>
                      <h3 className="font-medium">{c.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("life.club.members", { count: c.members })} / {c.maxMembers}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/vie-etudiante/clubs/${c.id}`}>
                          <Users className="mr-1 size-3.5" aria-hidden="true" />
                          {t("life.admin.viewMembers")}
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/vie-etudiante/gestion/rapport/${c.id}`}>
                          <FileText className="mr-1 size-3.5" aria-hidden="true" />
                          {t("life.admin.report")}
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setDeleteTarget({ type: "club", id: c.id, name: c.name })}
                      >
                        <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
                        {t("life.admin.deleteClub")}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )
        }
      </QueryBoundary>

      {conflict && (
        <ConflictAlert
          title={t("life.admin.conflictTitle")}
          description={`${conflict.message}. ${t("life.admin.conflictHint")}`}
          conflicts={conflict.conflicts}
          action={
            <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
              {t("common.close")}
            </button>
          }
        />
      )}

      <section aria-labelledby="requests-title" className="space-y-4">
        <h2 id="requests-title" className="text-lg font-semibold">
          {t("life.admin.requests")}
        </h2>
        <QueryBoundary query={query} moduleName={t("module.student-life")}>
          {(all) => {
            const count = (s: MembershipStatus) => all.filter((m) => m.status === s).length;
            const rows = status ? all.filter((m) => m.status === status) : all;
            return (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label={t("status.pending")} value={count("pending")} icon={ClipboardList} tone="amber" />
                  <StatCard label={t("status.confirmed")} value={count("confirmed")} icon={Check} tone="green" />
                  <StatCard label={t("status.refused")} value={count("refused")} icon={X} tone="red" />
                </div>
                <div className="w-full sm:w-56">
                  <label htmlFor="life-status" className="sr-only">
                    {t("life.admin.filter")}
                  </label>
                  <Select id="life-status" value={status} onChange={(e) => setStatus(e.target.value as MembershipStatus | "")}>
                    <option value="">{t("life.admin.allStatuses")}</option>
                    {(["pending", "confirmed", "refused"] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                {all.length === 0 ? (
                  <Card>
                    <EmptyState icon={ClipboardList} title={t("life.admin.empty")} />
                  </Card>
                ) : (
                  <DataTable
                    caption={t("life.admin.caption")}
                    columns={columns}
                    data={rows}
                    rowKey={(m) => m.id}
                    emptyTitle={t("life.admin.noMatch")}
                  />
                )}
              </>
            );
          }}
        </QueryBoundary>
      </section>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          {dialog === "club" && (
            <>
              <DialogTitle>{t("life.form.club.title")}</DialogTitle>
              <DialogDescription>{t("life.form.club.description")}</DialogDescription>
              <ClubForm
                onCancel={() => setDialog(null)}
                onCreated={() => {
                  setDialog(null);
                  clubs.refetch();
                }}
              />
            </>
          )}
          {dialog === "event" && (
            <>
              <DialogTitle>{t("life.form.event.title")}</DialogTitle>
              <DialogDescription>{t("life.form.event.description")}</DialogDescription>
              <EventForm clubs={clubs.data ?? []} onCancel={() => setDialog(null)} onCreated={() => setDialog(null)} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(o) => !o && !busy && setDecision(null)}
        loading={busy}
        destructive={decision?.status === "refused"}
        title={
          decision
            ? t(`life.admin.confirmTitle.${decision.status}`, { name: decision.membership.memberName, club: decision.membership.clubName })
            : ""
        }
        description={decision ? t(`life.admin.confirmBody.${decision.status}`) : undefined}
        confirmLabel={decision ? t(decision.status === "confirmed" ? "life.admin.confirm" : "life.admin.refuse") : undefined}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && !busy && setDeleteTarget(null)}
        loading={busy}
        destructive
        title={
          deleteTarget
            ? deleteTarget.type === "club"
              ? t("life.admin.deleteClubTitle", { name: deleteTarget.name })
              : t("life.admin.deleteEventTitle", { title: deleteTarget.name })
            : ""
        }
        description={
          deleteTarget
            ? deleteTarget.type === "club"
              ? t("life.admin.deleteClubBody")
              : t("life.admin.deleteEventBody")
            : undefined
        }
        confirmLabel={deleteTarget?.type === "club" ? t("life.admin.deleteClub") : t("life.admin.deleteEvent")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
