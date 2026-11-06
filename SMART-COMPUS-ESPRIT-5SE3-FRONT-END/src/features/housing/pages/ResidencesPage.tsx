import { Building } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { OccupancyChart } from "../components/OccupancyChart";
import { ResidenceCard } from "../components/ResidenceCard";
import { useResidences } from "../hooks";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";

export default function ResidencesPage() {
  const t = useT();
  const { role } = useAuth();
  const query = useResidences();
  return (
    <QueryBoundary query={query} moduleName={t("module.housing")} skeleton={<CatalogListSkeleton count={3} />}>
      {(residences) =>
        residences.length === 0 ? (
          <Card>
            <EmptyState icon={Building} title={t("housing.residences.empty")} />
          </Card>
        ) : (
          <div className="space-y-6">
            {role === "admin" && <OccupancyChart residences={residences} />}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {t("housing.residences.count", { count: residences.length })}
            </p>
            <CatalogList>
              {residences.map((r) => (
                <ResidenceCard key={r.id} residence={r} canRequest={role === "student"} />
              ))}
            </CatalogList>
          </div>
        )
      }
    </QueryBoundary>
  );
}
