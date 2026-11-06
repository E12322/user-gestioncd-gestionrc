import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { diffDays, formatDay, todayISO } from "../utils/time";
import { MAX_RENEWALS, type Loan, type LoanStatus } from "../types";

const STATUS_STYLE: Record<LoanStatus, string> = {
  active: "bg-blue-100 text-blue-900 border-blue-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-slate-100 text-slate-700 border-slate-200",
};

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  const t = useT();
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>
      {t(`lib.loan.status.${status}`)}
    </span>
  );
}

interface LoanRowProps {
  loan: Loan;
  busy?: boolean;
  onRenew?: (loan: Loan) => void;
}

/** Un prêt : ouvrage, dates, échéance (jours restants ou retard) et prolongation. */
export function LoanRow({ loan, busy, onRenew }: LoanRowProps) {
  const t = useT();
  const left = diffDays(todayISO(), loan.dueDate);
  const dueText =
    loan.status === "returned"
      ? loan.daysLate > 0
        ? t("lib.loan.lateReturned", { count: loan.daysLate })
        : t("lib.loan.returned", { date: formatDay(loan.returnedAt!) })
      : loan.status === "overdue"
        ? t("lib.loan.late", { count: loan.daysLate })
        : left === 0
          ? t("lib.loan.dueToday")
          : t("lib.loan.dueIn", { count: left });
  const canRenew = onRenew && loan.status !== "returned";

  return (
    <Card className={cn("flex flex-wrap items-center justify-between gap-3 p-4", loan.status === "overdue" && "border-red-300")}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug">
          <Link to={`/bibliotheque/livres/${loan.bookId}`} className="rounded hover:underline">
            {loan.bookTitle}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{t("lib.book.by", { author: loan.bookAuthor })}</p>
        <p className="mt-1 text-sm">
          {t("lib.loan.borrowed", { date: formatDay(loan.borrowedAt) })}
          {loan.status !== "returned" && <> · {t("lib.loan.due", { date: formatDay(loan.dueDate) })}</>}
        </p>
        <p className={cn("text-sm font-medium", loan.status === "overdue" ? "text-red-700" : "text-slate-700")}>
          {dueText}
          {loan.renewals > 0 && (
            <span className="font-normal text-muted-foreground"> · {t("lib.loan.renewals", { count: loan.renewals })}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <LoanStatusBadge status={loan.status} />
        {canRenew && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy || loan.renewals >= MAX_RENEWALS}
            onClick={() => onRenew(loan)}
            aria-label={`${t("lib.loan.renew")} — ${loan.bookTitle}`}
          >
            <RefreshCw aria-hidden="true" />
            {t("lib.loan.renew")}
          </Button>
        )}
      </div>
    </Card>
  );
}
