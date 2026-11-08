import { useMemo, useState } from "react";
import { FileText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import { resilierContrat } from "../api";
import { ContratStatusBadge } from "../components/ContratStatusBadge";
import { useChambres, useContratsVisibles, useViewer } from "../hooks";
import type { Contrat, ContratStatut } from "../types";
import { studentDisplayName } from "../utils/students";

const STATUTS: ContratStatut[] = ["ACTIF", "TERMINE", "RESILIE"];

/** Étudiant : détails de ses contrats. Admin : tous les contrats, résiliation possible. */
export default function ContratsPage() {
  const t = useT();
  const { role } = useAuth();
  const viewer = useViewer();
  const admin = role === "admin";

  const contrats = useContratsVisibles();
  const chambres = useChambres();
  const [statut, setStatut] = useState<"" | ContratStatut>("");
  const [toResilier, setToResilier] = useState<Contrat | null>(null);
  const [busy, setBusy] = useState(false);

  const chambreById = useMemo(() => new Map((chambres.data ?? []).map((c) => [c.id, c])), [chambres.data]);
  const roomLabel = (id: string) => {
    const chambre = chambreById.get(id);
    return chambre
      ? t("housing.contracts.room", { type: t(`housing.type.${chambre.type}`), numero: chambre.numero, batiment: chambre.batiment })
      : "—";
  };

  async function resilier() {
    if (!toResilier) return;
    setBusy(true);
    try {
      await resilierContrat(toResilier.id, viewer);
      toast.success(t("housing.contracts.resilied"));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      setToResilier(null);
      contrats.refetch();
      chambres.refetch();
    }
  }

  const columns = useMemo<Column<Contrat>[]>(
    () => [
      {
        key: "resident",
        header: t("housing.col.resident"),
        sortValue: (k) => k.residentId,
        cell: (k) => <span className="font-medium">{studentDisplayName(k.residentId)}</span>,
      },
      { key: "room", header: t("housing.col.room"), cell: (k) => roomLabel(k.chambreId) },
      {
        key: "period",
        header: t("housing.col.period"),
        sortValue: (k) => k.dateDebut,
        cell: (k) => t("housing.contracts.period", { debut: formatDate(k.dateDebut), fin: formatDate(k.dateFin) }),
      },
      {
        key: "rent",
        header: t("housing.col.rent"),
        sortValue: (k) => k.montantMensuel,
        cell: (k) => t("housing.contracts.rent", { amount: k.montantMensuel }),
      },
      { key: "status", header: t("housing.col.status"), sortValue: (k) => k.statut, cell: (k) => <ContratStatusBadge statut={k.statut} /> },
      {
        key: "actions",
        header: t("housing.col.actions"),
        cell: (k) =>
          k.statut === "ACTIF" ? (
            <Button variant="outline" size="sm" onClick={() => setToResilier(k)}>
              <RotateCcw aria-hidden="true" />
              {t("housing.contracts.resilier")}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, chambreById],
  );

  return (
    <div className="space-y-6">
      <QueryBoundary
        query={contrats}
        moduleName={t("module.housing")}
        skeleton={
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        {(list) => {
          if (list.length === 0) {
            return (
              <Card>
                <EmptyState icon={FileText} title={t("housing.contracts.empty")} />
              </Card>
            );
          }

          if (admin) {
            const rows = statut ? list.filter((k) => k.statut === statut) : list;
            return (
              <div className="space-y-4">
                <div className="w-full sm:w-56">
                  <label htmlFor="contrat-status" className="sr-only">
                    {t("housing.requests.filter")}
                  </label>
                  <Select id="contrat-status" value={statut} onChange={(e) => setStatut(e.target.value as "" | ContratStatut)}>
                    <option value="">{t("housing.contracts.allStatuses")}</option>
                    {STATUTS.map((s) => (
                      <option key={s} value={s}>
                        {t(`housing.contratStatus.${s}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <DataTable caption={t("housing.contracts.caption")} columns={columns} data={rows} rowKey={(k) => k.id} />
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("housing.contracts.count", { count: list.length })}
              </p>
              <ul className="space-y-4">
                {list.map((k) => (
                  <li key={k.id}>
                    <Card className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{roomLabel(k.chambreId)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("housing.contracts.period", { debut: formatDate(k.dateDebut), fin: formatDate(k.dateFin) })}
                          </p>
                        </div>
                        <ContratStatusBadge statut={k.statut} />
                      </div>
                      <p className="text-sm" aria-label={t("housing.col.rent")}>
                        {t("housing.contracts.rent", { amount: k.montantMensuel })}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          );
        }}
      </QueryBoundary>

      <ConfirmDialog
        open={toResilier !== null}
        onOpenChange={(o) => !o && !busy && setToResilier(null)}
        loading={busy}
        destructive
        title={toResilier ? t("housing.contracts.resilierTitle", { name: studentDisplayName(toResilier.residentId) }) : ""}
        description={t("housing.contracts.resilierBody")}
        confirmLabel={t("housing.contracts.resilier")}
        onConfirm={resilier}
      />
    </div>
  );
}
