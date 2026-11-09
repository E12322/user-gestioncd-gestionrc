import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Users, Calendar } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { useClubReport } from "../hooks";
import type { CampusEvent, MemberDetail } from "../types";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function ClubReportPage() {
  const t = useT();
  const { clubId = "" } = useParams();
  const [year, setYear] = useState(currentYear);
  const query = useClubReport(clubId, year);

  const memberColumns: Column<MemberDetail>[] = [
    { key: "name", header: t("life.col.member"), sortValue: (m) => m.memberName, cell: (m) => <span className="font-medium">{m.memberName}</span> },
    { key: "id", header: t("life.col.memberId"), sortValue: (m) => m.memberId, cell: (m) => m.memberId },
    { key: "role", header: t("life.col.role"), sortValue: (m) => m.memberRole, cell: (m) => m.memberRole },
    { key: "status", header: t("life.col.status"), sortValue: (m) => m.status, cell: (m) => <StatusPill status={m.status} /> },
    { key: "requested", header: t("life.col.joinedAt"), sortValue: (m) => m.requestedAt, cell: (m) => formatDateTime(m.requestedAt) },
  ];

  const eventColumns: Column<CampusEvent>[] = [
    { key: "title", header: "Titre", sortValue: (e) => e.title, cell: (e) => <span className="font-medium">{e.title}</span> },
    { key: "date", header: "Date", sortValue: (e) => e.date, cell: (e) => e.date },
    { key: "time", header: "Horaire", sortValue: (e) => e.start, cell: (e) => `${e.start}–${e.end}` },
    { key: "location", header: "Lieu", sortValue: (e) => e.location, cell: (e) => e.location },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/vie-etudiante/gestion">
            <ArrowLeft aria-hidden="true" />
            {t("life.tab.admin")}
          </Link>
        </Button>
        <div className="w-32">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <QueryBoundary query={query} moduleName={t("module.student-life")}>
        {(report) => (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">
                {t("life.admin.reportTitle", { name: report.clubName, year: String(report.year) })}
              </h2>
              <p className="text-sm text-muted-foreground">{report.category} · {t("life.admin.reportDesc")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t("life.admin.totalMembers")} value={report.totalMembers} icon={Users} tone="blue" />
              <StatCard label={t("life.admin.confirmedMembers")} value={report.confirmedMembers} icon={Users} tone="green" />
              <StatCard label={t("life.admin.pendingMembers")} value={report.pendingMembers} icon={Users} tone="amber" />
              <StatCard label={t("life.admin.totalEvents")} value={report.totalEvents} icon={Calendar} tone="navy" />
            </div>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="size-5" aria-hidden="true" />
                {t("life.admin.reportMembers")}
              </h3>
              {report.members.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {t("life.admin.membersEmpty")}
                </Card>
              ) : (
                <DataTable
                  caption={t("life.admin.reportMembers")}
                  columns={memberColumns}
                  data={report.members}
                  rowKey={(m) => m.memberId}
                />
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="size-5" aria-hidden="true" />
                {t("life.admin.reportEvents")}
              </h3>
              {report.events.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  {t("life.admin.noEvents")}
                </Card>
              ) : (
                <DataTable
                  caption={t("life.admin.reportEvents")}
                  columns={eventColumns}
                  data={report.events}
                  rowKey={(e) => e.id}
                />
              )}
            </section>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
