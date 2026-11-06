import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/i18n";
import type { AccountStatus } from "../types";

const STYLES: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STYLES[status])}>
      {t(`users.status.${status}`)}
    </span>
  );
}
