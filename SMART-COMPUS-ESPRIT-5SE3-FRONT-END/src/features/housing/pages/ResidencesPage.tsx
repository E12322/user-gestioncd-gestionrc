import { Link } from "react-router-dom";
import { BedDouble, Building2, CheckCircle2, ClipboardList, DoorOpen, FileText, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import { BatimentOccupancy, type BatimentOccupancyRow } from "../components/BatimentOccupancy";
import { ContratStatusBadge } from "../components/ContratStatusBadge";
import { DemandeStatusBadge } from "../components/DemandeStatusBadge";
import { useChambres, useContratsVisibles, useDemandes } from "../hooks";
import { studentDisplayName } from "../utils/students";

/** Vue d'ensemble : disponibilité des chambres, demandes en cours et contrats. */
export default function ResidencesPage() {
  const t = useT();
  const { role } = useAuth();
  const admin = role === "admin";
  const chambres = useChambres();
  const demandes = useDemandes();
  const contrats = useContratsVisibles();

  const rooms = chambres.data ?? [];
  const pending = demandes.data?.filter((d) => d.statut === "EN_ATTENTE");
  const actifs = contrats.data?.filter((k) => k.statut === "ACTIF");

  const occupancy: BatimentOccupancyRow[] = [...new Set(rooms.map((c) => c.batiment))]
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((batiment) => {
      const list = rooms.filter((c) => c.batiment === batiment);
      return { name: batiment, occupied: list.filter((c) => !c.disponible).length, total: list.length };
    });

  return (
    <div className="space-y-6">
      <QueryBoundary
        query={chambres}
        moduleName={t("module.housing")}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        {(allRooms) => {
          const disponibles = allRooms.filter((c) => c.disponible).length;
          return (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t("housing.dash.rooms")} value={allRooms.length} icon={Building2} tone="blue" />
              <StatCard label={t("housing.dash.available")} value={disponibles} icon={CheckCircle2} tone="green" />
              <StatCard label={t("housing.dash.occupied")} value={allRooms.length - disponibles} icon={DoorOpen} tone="amber" />
              <StatCard
                label={admin ? t("housing.dash.pending") : t("housing.dash.myRequests")}
                value={pending?.length ?? "…"}
                icon={ClipboardList}
                tone="navy"
              />
            </div>
          );
        }}
      </QueryBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <QueryBoundary query={chambres} moduleName={t("module.housing")} skeleton={<Skeleton className="h-64 rounded-xl" />}>
          {() => <BatimentOccupancy rows={occupancy} />}
        </QueryBoundary>

        <div className="space-y-6">
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{admin ? t("housing.dash.recent") : t("housing.dash.myLatest")}</h2>
              <Button variant="link" size="sm" asChild>
                <Link to="/residences/demandes">{t("common.seeAll")}</Link>
              </Button>
            </div>
            <QueryBoundary
              query={demandes}
              moduleName={t("module.housing")}
              skeleton={
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              }
            >
              {(list) => {
                const visible = (admin ? (pending ?? []) : list).slice(0, 4);
                if (visible.length === 0) {
                  return (
                    <EmptyState
                      icon={ClipboardList}
                      title={admin ? t("housing.dash.noPending") : t("housing.dash.noPersonal")}
                      action={
                        !admin ? (
                          <Button size="sm" asChild>
                            <Link to="/residences/demandes/new">
                              <Plus aria-hidden="true" />
                              {t("housing.dash.create")}
                            </Link>
                          </Button>
                        ) : undefined
                      }
                    />
                  );
                }
                return (
                  <ul className="divide-y rounded-lg border">
                    {visible.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{studentDisplayName(d.etudiantId)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("housing.requests.stay", { debut: formatDate(d.dateArrivee), fin: formatDate(d.dateDepart) })}
                          </p>
                        </div>
                        <DemandeStatusBadge statut={d.statut} />
                      </li>
                    ))}
                  </ul>
                );
              }}
            </QueryBoundary>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{admin ? t("housing.dash.activeContracts") : t("housing.dash.myContracts")}</h2>
              <Button variant="link" size="sm" asChild>
                <Link to="/residences/contrats">{t("common.seeAll")}</Link>
              </Button>
            </div>
            <QueryBoundary
              query={contrats}
              moduleName={t("module.housing")}
              skeleton={
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              }
            >
              {() =>
                (actifs ?? []).length === 0 ? (
                  <EmptyState icon={FileText} title={t("housing.contracts.empty")} />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {(actifs ?? []).slice(0, 4).map((k) => (
                      <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{studentDisplayName(k.residentId)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t("housing.contracts.rent", { amount: k.montantMensuel })} ·{" "}
                            {t("housing.contracts.period", { debut: formatDate(k.dateDebut), fin: formatDate(k.dateFin) })}
                          </p>
                        </div>
                        <ContratStatusBadge statut={k.statut} />
                      </li>
                    ))}
                  </ul>
                )
              }
            </QueryBoundary>
          </Card>
        </div>
      </div>

      {!admin && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <BedDouble className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("housing.new.description")}</p>
          </div>
          <Button asChild>
            <Link to="/residences/demandes/new">
              <Plus aria-hidden="true" />
              {t("housing.requests.new")}
            </Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
