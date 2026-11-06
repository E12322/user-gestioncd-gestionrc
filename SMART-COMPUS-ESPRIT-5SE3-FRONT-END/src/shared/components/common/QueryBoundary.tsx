import type { ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { QueryState } from "@/shared/api/useQuery";
import { useT } from "@/shared/i18n";
import { EmptyState } from "./EmptyState";
import { ServiceUnavailableView } from "./ErrorViews";

interface QueryBoundaryProps<T> {
  query: QueryState<T>;
  moduleName: string;
  /** Rendu des données (appelé seulement quand `data` existe). */
  children: (data: T) => ReactNode;
  /** Squelette personnalisé ; par défaut 3 blocs. */
  skeleton?: ReactNode;
}

/** Gère les 3 états d'une requête : chargement (squelette), erreur (503 / générique + réessayer), données. */
export function QueryBoundary<T>({ query, moduleName, children, skeleton }: QueryBoundaryProps<T>) {
  const t = useT();
  const { data, error, isLoading, refetch } = query;

  if (error && !data) {
    if (error.isUnavailable) return <ServiceUnavailableView moduleName={moduleName} onRetry={refetch} />;
    return (
      <Card>
        <EmptyState
          title={t("error.generic")}
          description={error.message}
          action={<Button onClick={refetch}>{t("common.retry")}</Button>}
        />
      </Card>
    );
  }
  if (isLoading && !data) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">{t("app.loading")}</span>
        {skeleton ?? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </div>
    );
  }
  return <>{data !== undefined && children(data)}</>;
}
