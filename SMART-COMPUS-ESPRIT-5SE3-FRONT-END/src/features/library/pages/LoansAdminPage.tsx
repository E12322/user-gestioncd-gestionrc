import { useMemo, useState } from "react";
import { AlertTriangle, BookCheck, BookOpen, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Select } from "@/shared/components/ui/select";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { isApiError } from "@/shared/api/errors";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { returnLoan } from "../api";
import { BookForm } from "../components/BookForm";
import { LoanStatusBadge } from "../components/LoanRow";
import { useLoans, useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { Loan, LoanStatus } from "../types";

/** Administrateur : suivi de tous les prêts, enregistrement des retours et ajout d'ouvrages au catalogue. */
export default function LoansAdminPage() {
  const t = useT();
  const viewer = useViewer();
  const query = useLoans();
  const [status, setStatus] = useState<LoanStatus | "">("");
  const [returning, setReturning] = useState<Loan | null>(null);
  const [conflict, setConflict] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  async function confirm() {
    if (!returning) return;
    setBusy(true);
    setConflict(undefined);
    try {
      await returnLoan(returning.id, viewer);
      toast.success(t("lib.admin.returnedOk", { title: returning.bookTitle }));
    } catch (e) {
      if (isApiError(e) && e.isConflict) setConflict(e.message);
      else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setReturning(null);
      setBusy(false);
      query.refetch();
    }
  }

  const columns = useMemo<Column<Loan>[]>(
    () => [
      {
        key: "borrower",
        header: t("lib.col.borrower"),
        sortValue: (l) => l.borrowerName,
        cell: (l) => (
          <div>
            <p className="font-medium">{l.borrowerName}</p>
            <p className="text-xs text-muted-foreground">{t(ROLE_LABEL[l.borrowerRole])}</p>
          </div>
        ),
      },
      {
        key: "book",
        header: t("lib.col.book"),
        sortValue: (l) => l.bookTitle,
        cell: (l) => (
          <div>
            <p className="font-medium">{l.bookTitle}</p>
            <p className="text-xs text-muted-foreground">{l.bookAuthor}</p>
          </div>
        ),
      },
      { key: "borrowed", header: t("lib.col.borrowed"), sortValue: (l) => l.borrowedAt, cell: (l) => formatDay(l.borrowedAt) },
      {
        key: "due",
        header: t("lib.col.due"),
        sortValue: (l) => l.dueDate,
        cell: (l) => (
          <div>
            <p>{formatDay(l.dueDate)}</p>
            {l.daysLate > 0 && (
              <p className="text-xs font-semibold text-red-700">
                {l.status === "returned" ? t("lib.loan.lateReturned", { count: l.daysLate }) : t("lib.loan.late", { count: l.daysLate })}
              </p>
            )}
          </div>
        ),
      },
      { key: "status", header: t("lib.col.status"), sortValue: (l) => l.status, cell: (l) => <LoanStatusBadge status={l.status} /> },
      {
        key: "actions",
        header: t("lib.col.actions"),
        cell: (l) =>
          l.status === "returned" ? (
            <span className="text-xs text-muted-foreground">{l.returnedAt ? formatDay(l.returnedAt) : "—"}</span>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t("lib.admin.return")} — ${l.bookTitle}, ${l.borrowerName}`}
              title={t("lib.admin.return")}
              className="text-green-800 hover:bg-green-50"
              onClick={() => setReturning(l)}
            >
              <Undo2 aria-hidden="true" />
            </Button>
          ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <div>
        <Button onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" />
          {t("lib.admin.newBook")}
        </Button>
      </div>

      {conflict && (
        <ConflictAlert
          title={t("lib.admin.conflictTitle")}
          description={conflict}
          action={
            <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
              {t("common.close")}
            </button>
          }
        />
      )}

      <QueryBoundary query={query} moduleName={t("module.library")}>
        {(all) => {
          const count = (s: LoanStatus) => all.filter((l) => l.status === s).length;
          const rows = status ? all.filter((l) => l.status === status) : all;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("lib.admin.stat.active")} value={count("active")} icon={BookOpen} tone="blue" />
                <StatCard label={t("lib.admin.stat.overdue")} value={count("overdue")} icon={AlertTriangle} tone="red" />
                <StatCard label={t("lib.admin.stat.returned")} value={count("returned")} icon={BookCheck} tone="green" />
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="loan-status" className="sr-only">
                  {t("lib.admin.filter")}
                </label>
                <Select id="loan-status" value={status} onChange={(e) => setStatus(e.target.value as LoanStatus | "")}>
                  <option value="">{t("lib.admin.allStatuses")}</option>
                  {(["overdue", "active", "returned"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`lib.loan.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {all.length === 0 ? (
                <Card>
                  <EmptyState icon={BookOpen} title={t("lib.admin.empty")} />
                </Card>
              ) : (
                <DataTable
                  caption={t("lib.admin.caption")}
                  columns={columns}
                  data={rows}
                  rowKey={(l) => l.id}
                  emptyTitle={t("lib.admin.noMatch")}
                />
              )}
            </>
          );
        }}
      </QueryBoundary>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogTitle>{t("lib.form.title")}</DialogTitle>
          <DialogDescription>{t("lib.form.description")}</DialogDescription>
          <BookForm onCancel={() => setAdding(false)} onCreated={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(o) => !o && !busy && setReturning(null)}
        loading={busy}
        title={returning ? t("lib.admin.returnTitle", { title: returning.bookTitle }) : ""}
        description={returning ? t("lib.admin.returnBody", { name: returning.borrowerName }) : undefined}
        confirmLabel={t("lib.admin.return")}
        onConfirm={confirm}
      />
    </div>
  );
}
