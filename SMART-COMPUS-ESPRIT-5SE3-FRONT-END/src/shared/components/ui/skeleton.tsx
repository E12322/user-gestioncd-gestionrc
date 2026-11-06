import { cn } from "@/shared/lib/utils";

/** Bloc de chargement. Décoratif : masqué aux lecteurs d'écran (le conteneur annonce « Chargement »). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-slate-200", className)} {...props} />;
}
