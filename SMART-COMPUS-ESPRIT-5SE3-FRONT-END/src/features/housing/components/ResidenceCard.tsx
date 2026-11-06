import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { CatalogRow } from "@/shared/components/common/CatalogRow";
import { useT } from "@/shared/i18n";
import type { Residence } from "../types";

interface ResidenceCardProps {
  residence: Residence;
  /** Affiche le bouton « Faire une demande » (étudiant). */
  canRequest?: boolean;
}

/** Ligne du catalogue des résidences : adresse, loyer, services et jauge d'occupation des lits. */
export function ResidenceCard({ residence, canRequest }: ResidenceCardProps) {
  const t = useT();
  const free = residence.capacity - residence.occupied;
  const full = free <= 0;
  return (
    <CatalogRow
      title={residence.name}
      badge={full && <span className="text-sm font-semibold text-red-800">{t("housing.residence.full")}</span>}
      meta={[
        residence.address,
        t("housing.residence.walk", { count: residence.walkMinutes }),
        t("housing.residence.rent", { amount: residence.monthlyRent }),
      ]}
      extra={
        <p>
          <span className="sr-only">{t("housing.residence.amenities")} : </span>
          {residence.amenities.join(", ")}
        </p>
      }
      gauge={
        <>
          <CapacityGauge used={residence.occupied} capacity={residence.capacity} label={t("housing.residence.beds")} />
          {!full && <p className="mt-1 text-xs text-muted-foreground">{t("housing.residence.free", { count: free })}</p>}
        </>
      }
      actions={
        canRequest && (
          <Button size="sm" asChild={!full} disabled={full} aria-label={`${t("housing.residence.request")} — ${residence.name}`}>
            {full ? (
              <span>{t("housing.residence.request")}</span>
            ) : (
              <Link to={`/residences/ma-demande?residence=${residence.id}`}>{t("housing.residence.request")}</Link>
            )}
          </Button>
        )
      }
    />
  );
}
