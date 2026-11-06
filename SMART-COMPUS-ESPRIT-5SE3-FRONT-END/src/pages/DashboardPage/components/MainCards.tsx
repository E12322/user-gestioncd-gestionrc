import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { useModules } from "@/shared/modules/ModulesContext";
import { useT } from "@/shared/i18n";
import { TONES } from "@/shared/lib/tones";
import { cn } from "@/shared/lib/utils";
import type { DashboardData } from "../types";

/** Liste de lignes : point de couleur + titre + pastille de statut + chevron. */
export function ItemRows({ title, items }: { title: string; items: DashboardData["items"] }) {
  const { getModule } = useModules();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={getModule(item.module).path} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-secondary/60">
                <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", TONES[item.tone].dot)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                </span>
                <StatusPill status={item.status} />
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ActivityChart({ data }: { data: DashboardData["activity"] }) {
  const t = useT();
  const summary = data.map((d) => `${d.day} : ${d.value}`).join(", ");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.activity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`${t("dashboard.activity")} — ${summary}`} className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#475569", fontSize: 12 }} allowDecimals={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
              <Bar dataKey="value" name="Activité" fill="#60A5FA" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function Announcements({ items }: { items: DashboardData["announcements"] }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.announcements")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {items.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span aria-hidden="true" className={cn("mt-1 w-1 shrink-0 rounded-full", TONES[a.tone].dot)} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.date}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
