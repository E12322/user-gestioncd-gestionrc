import type { ReactNode } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

/** Liste de catalogue : lignes séparées par des filets, jamais une grille de cartes identiques. */
export function CatalogList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y border-y", className)}>{children}</ul>;
}

/** Squelette d'une liste de catalogue pendant le chargement. */
export function CatalogListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y border-y" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="py-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

interface CatalogRowProps {
  /** Titre (souvent un lien). */
  title: ReactNode;
  /** Marque à côté du titre : état, disponibilité, « Complète »… */
  badge?: ReactNode;
  /** Informations courtes, jointes par « · » (auteur, lieu, capacité…). Les valeurs vides sont ignorées. */
  meta?: (string | undefined | false)[];
  /** Texte descriptif sous les informations. */
  description?: ReactNode;
  /** Contenu libre sous les informations (équipements, file d'attente…). */
  extra?: ReactNode;
  /** Jauge d'occupation. */
  gauge?: ReactNode;
  /** Boutons d'action. */
  actions?: ReactNode;
}

/**
 * Une entrée de catalogue : à gauche le titre et ses informations, au milieu la jauge, à droite les actions.
 * Sur petit écran tout s'empile. Même structure pour les cours, salles, résidences, clubs et livres.
 */
export function CatalogRow({ title, badge, meta, description, extra, gauge, actions }: CatalogRowProps) {
  const info = (meta ?? []).filter(Boolean).join(" · ");
  return (
    <li className="grid gap-x-10 gap-y-3 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold leading-snug">{title}</h3>
          {badge}
        </div>
        {info && <p className="mt-1 text-sm text-muted-foreground">{info}</p>}
        {description && <p className="mt-2 line-clamp-2 max-w-[62ch] text-sm">{description}</p>}
        {extra && <div className="mt-2 text-sm text-muted-foreground">{extra}</div>}
      </div>
      <div className="min-w-0">{gauge}</div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
    </li>
  );
}
