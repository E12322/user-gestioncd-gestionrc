import { CheckCircle2, XCircle } from "lucide-react";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import type { LoginEvent } from "../types";

interface Props {
  events: LoginEvent[] | undefined;
  loading?: boolean;
  showUser?: boolean;
  pageSize?: number;
}

export function LoginHistoryTable({ events, loading, showUser, pageSize = 8 }: Props) {
  const t = useT();
  const columns: Column<LoginEvent>[] = [
    {
      key: "date",
      header: t("users.history.date"),
      cell: (e) => <time dateTime={e.date}>{formatDateTime(e.date)}</time>,
      sortValue: (e) => e.date,
    },
    ...(showUser
      ? [{ key: "user", header: t("users.history.user"), cell: (e: LoginEvent) => e.userName, sortValue: (e: LoginEvent) => e.userName }]
      : []),
    { key: "ip", header: t("users.history.ip"), cell: (e) => <code className="text-xs">{e.ip}</code> },
    { key: "device", header: t("users.history.device"), cell: (e) => e.device },
    {
      key: "result",
      header: t("users.history.result"),
      sortValue: (e) => Number(e.success),
      cell: (e) => (
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", e.success ? "text-green-800" : "text-red-800")}>
          {e.success ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
          {e.success ? t("users.history.success") : t("users.history.failure")}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      caption={t("users.history.caption")}
      columns={columns}
      data={events}
      rowKey={(e) => e.id}
      loading={loading}
      pageSize={pageSize}
      emptyTitle={t("users.history.empty")}
    />
  );
}
