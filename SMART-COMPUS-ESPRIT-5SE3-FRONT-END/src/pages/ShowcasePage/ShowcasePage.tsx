import { useState } from "react";
import { Building2, CalendarCheck, Home, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill, type Status } from "@/shared/components/common/StatusPill";
import { Stepper } from "@/shared/components/common/Stepper";
import { Timeline } from "@/shared/components/common/Timeline";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface Row {
  id: string;
  room: string;
  slot: string;
  status: Status;
}
const rows: Row[] = [
  { id: "1", room: "Amphi A", slot: "Mar. 10:00–12:00", status: "confirmed" },
  { id: "2", room: "Labo Réseaux", slot: "Jeu. 14:00–16:00", status: "pending" },
  { id: "3", room: "Salle C12", slot: "Ven. 09:00–10:30", status: "validated" },
  { id: "4", room: "Amphi B", slot: "Ven. 11:00–12:00", status: "refused" },
];
const columns: Column<Row>[] = [
  { key: "room", header: "Salle", cell: (r) => r.room, sortValue: (r) => r.room },
  { key: "slot", header: "Créneau", cell: (r) => r.slot },
  { key: "status", header: "Statut", cell: (r) => <StatusPill status={r.status} />, sortValue: (r) => r.status },
];

/** Catalogue des composants partagés (page de démo, accessible depuis le panneau « Mode démo »). */
export default function Showcase() {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title="Catalogue de composants" description="Aperçu des composants partagés réutilisables par tous les modules." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs" value="2 418" hint="+5 % cette semaine" icon={Users} tone="navy" />
        <StatCard label="Salles libres" value="14" icon={Building2} tone="blue" />
        <StatCard label="Chambres" value="343" icon={Home} tone="green" />
        <StatCard label="En attente" value="9" icon={CalendarCheck} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statuts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["pending", "validated", "confirmed", "refused"] as const).map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stepper, jauges et chronologie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <Stepper
              current={1}
              steps={[{ label: "Demande" }, { label: "Validation" }, { label: "Affectation" }, { label: "Confirmation" }]}
            />
            <CapacityGauge label="Résidence Les Oliviers" used={212} capacity={240} />
            <CapacityGauge label="Résidence El Manar" used={131} capacity={180} />
            <CapacityGauge label="Amphi B" used={60} capacity={200} />
          </div>
          <Timeline
            items={[
              { id: "1", title: "Demande déposée", date: "3 oct. 2026, 09:12", tone: "navy" },
              { id: "2", title: "Validée par le responsable", description: "M. Jlassi", date: "5 oct. 2026, 14:40", tone: "green" },
              { id: "3", title: "En attente d'affectation", date: "6 oct. 2026, 08:00", tone: "amber" },
            ]}
          />
        </CardContent>
      </Card>

      <ConflictAlert
        title="Salle déjà réservée"
        description="Le créneau demandé chevauche une réservation existante."
        conflicts={["Amphi A — mar. 10:00–12:00 (K. Trabelsi)"]}
      />

      <DataTable caption="Réservations de salles" columns={columns} data={rows} rowKey={(r) => r.id} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <EmptyState title="Aucune réservation" description="Vous n'avez pas encore de réservation." />
        </Card>
        <Card className="space-y-3 p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirm(true)} variant="destructive">
          Annuler la réservation
        </Button>
        <Button variant="outline" onClick={() => toast.success("Réservation confirmée")}>
          Toast succès
        </Button>
        <Button variant="outline" onClick={() => toast.error("Échec de l'opération")}>
          Toast erreur
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive
        title="Annuler la réservation ?"
        description="Cette action est définitive."
        confirmLabel="Oui, annuler"
        cancelLabel="Non, garder"
        onConfirm={() => {
          setConfirm(false);
          toast.success("Réservation annulée");
        }}
      />
    </div>
  );
}
