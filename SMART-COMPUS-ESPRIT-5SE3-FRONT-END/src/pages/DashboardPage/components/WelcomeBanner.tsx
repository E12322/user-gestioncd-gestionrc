import { TrendingUp } from "lucide-react";
import { useT } from "@/shared/i18n";
import type { DashboardData } from "../types";

/** En-tête du tableau de bord : salutation, puis deux indicateurs sobres (sans bandeau ni cartes imbriquées). */
export function WelcomeBanner({ name, data }: { name: string; data: DashboardData }) {
  const t = useT();
  const { progress, kpi } = data;
  return (
    <section aria-labelledby="welcome-title" className="border-b pb-6">
      <h1 id="welcome-title" className="text-3xl lg:text-4xl">
        {t("dashboard.welcome", { name: name.split(" ")[0]! })}
      </h1>
      <p className="mt-2 max-w-[58ch] text-muted-foreground">{data.subtitle}</p>

      <dl className="mt-6 grid max-w-2xl gap-x-12 gap-y-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{progress.title}</dt>
          <dd className="mt-1 text-xl font-semibold tabular text-navy">{progress.value} %</dd>
          <dd>
            <div
              role="progressbar"
              aria-valuenow={progress.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={progress.title}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
            >
              <div className="h-full rounded-full bg-navy" style={{ width: `${progress.value}%` }} />
            </div>
            <span className="mt-1.5 block text-sm text-muted-foreground">{progress.caption}</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{kpi.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular text-navy">{kpi.value}</dd>
          <dd className="mt-2 flex items-center gap-1.5 text-sm font-medium text-green-800">
            <TrendingUp className="size-4" aria-hidden="true" />
            {kpi.hint}
          </dd>
        </div>
      </dl>
    </section>
  );
}
