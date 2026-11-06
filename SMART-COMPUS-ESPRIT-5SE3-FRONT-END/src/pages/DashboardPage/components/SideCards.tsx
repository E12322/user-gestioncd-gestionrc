import { Link } from "react-router-dom";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { canAccess, useModules } from "@/shared/modules/ModulesContext";
import { useT } from "@/shared/i18n";
import { TONES } from "@/shared/lib/tones";
import { cn } from "@/shared/lib/utils";
import type { DashboardData } from "../types";

export function ProfileCard() {
  const t = useT();
  const { user } = useAuth();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 pt-6 text-center">
        <UserAvatar name={user.name} src={user.avatarUrl} className="size-16" fallbackClassName="text-lg" />
        <p className="mt-2 font-semibold">{user.name}</p>
        <p className="text-sm text-muted-foreground">{t(ROLE_LABEL[user.role])}</p>
        <p className="text-xs text-muted-foreground">{user.id}</p>
        <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
          <Link to="/profil">{t("dashboard.viewProfile")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function QuickActions({ actions }: { actions: DashboardData["quickActions"] }) {
  const t = useT();
  const { role } = useAuth();
  const { getModule } = useModules();
  const allowed = actions.filter((a) => canAccess(getModule(a.module), role));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.quickActions")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {allowed.map((a) => (
          <Button key={a.label} variant="outline" className="justify-start" asChild>
            <Link to={getModule(a.module).path}>{a.label}</Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

export function UpcomingEvents({ events }: { events: DashboardData["events"] }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.upcoming")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span aria-hidden="true" className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TONES[e.tone].dot)} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.when}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
