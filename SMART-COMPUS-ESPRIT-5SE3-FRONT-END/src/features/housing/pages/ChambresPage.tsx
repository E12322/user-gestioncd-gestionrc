import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { createChambre, deleteChambre, updateChambre } from "../api";
import { ChambreCard } from "../components/ChambreCard";
import { ChambreFormDialog } from "../components/ChambreFormDialog";
import { useChambres, useViewer } from "../hooks";
import { CHAMBRE_TYPES, type Chambre, type ChambreType } from "../types";

type Disponibilite = "" | "dispo" | "occupee";

/** Liste des chambres avec filtres type / bâtiment / disponibilité ; CRUD réservé à l'administrateur. */
export default function ChambresPage() {
  const t = useT();
  const { role } = useAuth();
  const viewer = useViewer();
  const admin = role === "admin";
  const chambres = useChambres();

  const [type, setType] = useState<"" | ChambreType>("");
  const [batiment, setBatiment] = useState("");
  const [statut, setStatut] = useState<Disponibilite>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Chambre | null>(null);
  const [busy, setBusy] = useState(false);

  const { mutate: create } = useMutation(createChambre);
  const { mutate: update } = useMutation(updateChambre);
  const { mutate: remove } = useMutation(deleteChambre);

  const batiments = useMemo(
    () => [...new Set((chambres.data ?? []).map((c) => c.batiment))].sort((a, b) => a.localeCompare(b, "fr")),
    [chambres.data],
  );

  const rows = (chambres.data ?? []).filter(
    (c) =>
      (type === "" || c.type === type) &&
      (batiment === "" || c.batiment === batiment) &&
      (statut === "" || (statut === "dispo" ? c.disponible : !c.disponible)),
  );

  async function toggleDisponibilite(chambre: Chambre) {
    setBusy(true);
    try {
      await update(chambre.id, { disponible: !chambre.disponible }, viewer);
      toast.success(t("housing.rooms.updated", { numero: chambre.numero }));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      chambres.refetch();
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await remove(toDelete.id, viewer);
      toast.success(t("housing.rooms.deleted", { numero: toDelete.numero }));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setBusy(false);
      setToDelete(null);
      chambres.refetch();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="filter-type" className="text-sm font-medium">
              {t("housing.rooms.filterType")}
            </label>
            <Select id="filter-type" value={type} onChange={(e) => setType(e.target.value as "" | ChambreType)}>
              <option value="">{t("housing.rooms.allTypes")}</option>
              {CHAMBRE_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`housing.type.${x}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filter-batiment" className="text-sm font-medium">
              {t("housing.rooms.filterBatiment")}
            </label>
            <Select id="filter-batiment" value={batiment} onChange={(e) => setBatiment(e.target.value)}>
              <option value="">{t("housing.rooms.allBatiments")}</option>
              {batiments.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filter-statut" className="text-sm font-medium">
              {t("housing.rooms.filterStatus")}
            </label>
            <Select id="filter-statut" value={statut} onChange={(e) => setStatut(e.target.value as Disponibilite)}>
              <option value="">{t("housing.rooms.allStatuses")}</option>
              <option value="dispo">{t("housing.rooms.available")}</option>
              <option value="occupee">{t("housing.rooms.occupied")}</option>
            </Select>
          </div>
        </div>
        {admin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t("housing.rooms.add")}
          </Button>
        )}
      </div>

      <QueryBoundary
        query={chambres}
        moduleName={t("module.housing")}
        skeleton={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        }
      >
        {() =>
          rows.length === 0 ? (
            <Card>
              <EmptyState icon={Building2} title={t("housing.rooms.empty")} />
            </Card>
          ) : (
            <div className="space-y-4">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("housing.rooms.count", { count: rows.length })}
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((c) => (
                  <ChambreCard
                    key={c.id}
                    chambre={c}
                    admin={admin}
                    busy={busy}
                    onToggleDisponibilite={(x) => void toggleDisponibilite(x)}
                    onDelete={setToDelete}
                  />
                ))}
              </div>
            </div>
          )
        }
      </QueryBoundary>

      <ChambreFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        busy={busy}
        onSubmit={async (input) => {
          setBusy(true);
          try {
            const created = await create(input, viewer);
            toast.success(t("housing.rooms.created", { numero: created.numero }));
            setCreateOpen(false);
          } finally {
            setBusy(false);
            chambres.refetch();
          }
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && !busy && setToDelete(null)}
        loading={busy}
        destructive
        title={toDelete ? t("housing.rooms.deleteTitle", { numero: toDelete.numero }) : ""}
        description={toDelete ? t("housing.rooms.deleteBody", { numero: toDelete.numero, batiment: toDelete.batiment }) : undefined}
        confirmLabel={t("housing.rooms.delete")}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
