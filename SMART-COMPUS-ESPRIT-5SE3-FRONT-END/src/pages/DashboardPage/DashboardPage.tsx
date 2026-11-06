import { CloudOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QuickAccessCard } from "@/shared/components/common/QuickAccessCard";
import { useAuth } from "@/shared/auth/AuthContext";
import { canAccess, useModules } from "@/shared/modules/ModulesContext";
import { useT } from "@/shared/i18n";
import { useDashboard } from "./hooks";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { ActivityChart, Announcements, ItemRows } from "./components/MainCards";
import { ProfileCard, QuickActions, UpcomingEvents } from "./components/SideCards";

function DashboardSkeleton() {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <span className="sr-only">{t("app.loading")}</span>
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useT();
  const { getModule } = useModules();
  const { user, role } = useAuth();
  const { data, error, isLoading, refetch } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <Card>
        <EmptyState icon={CloudOff} title={t("dashboard.loadError")} action={<Button onClick={refetch}>{t("common.retry")}</Button>} />
      </Card>
    );
  }

  const quick = data.quickAccess
    .map(getModule)
    .filter((m) => canAccess(m, role))
    .slice(0, 4);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        <WelcomeBanner name={user.name} data={data} />

        <section aria-labelledby="quick-title">
          <h2 id="quick-title" className="mb-3 text-lg font-semibold">
            {t("dashboard.quickAccess")}
          </h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {quick.map((m) => (
              <QuickAccessCard key={m.id} to={m.path} title={t(m.labelKey)} icon={m.icon} tone={m.tone} />
            ))}
          </div>
        </section>

        <ItemRows title={data.listTitle} items={data.items} />
        <ActivityChart data={data.activity} />
        <Announcements items={data.announcements} />
      </div>

      <aside aria-label="Informations complémentaires" className="space-y-6">
        <ProfileCard />
        <QuickActions actions={data.quickActions} />
        <UpcomingEvents events={data.events} />
      </aside>
    </div>
  );
}
