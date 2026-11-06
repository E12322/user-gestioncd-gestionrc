import { useState } from "react";
import { AlertTriangle, BookMarked, Library } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { renewLoan } from "../api";
import { LoanRow } from "../components/LoanRow";
import { useMyLibrary, useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { Loan } from "../types";

type Conflict = { loan: Loan; message: string; conflicts: string[] };

/** Mes prêts : en cours (retards signalés, prolongation), mes réservations et historique. */
export default function MyLoansPage() {
  const t = useT();
  const viewer = useViewer();
  const query = useMyLibrary();
  const [busyId, setBusyId] = useState<string>();
  const [conflict, setConflict] = useState<Conflict>();

  async function renew(loan: Loan) {
    setConflict(undefined);
    setBusyId(loan.id);
    try {
      const updated = await renewLoan(loan.id, viewer);
      toast.success(t("lib.loan.renewedOk", { date: formatDay(updated.dueDate) }));
    } catch (e) {
      if (isApiError(e) && e.isConflict)
        setConflict({ loan, message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setBusyId(undefined);
      query.refetch();
    }
  }

  return (
    <div className="space-y-6">
      {conflict && (
        <ConflictAlert
          title={`${t("lib.loan.renewConflictTitle")} — ${conflict.loan.bookTitle}`}
          description={conflict.message}
          conflicts={conflict.conflicts}
          action={
            <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
              {t("common.close")}
            </button>
          }
        />
      )}

      <QueryBoundary
        query={query}
        moduleName={t("module.library")}
        skeleton={
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        {({ loans, reservations, limit }) => {
          const current = loans.filter((l) => l.status !== "returned");
          const history = loans.filter((l) => l.status === "returned");
          const overdue = current.filter((l) => l.status === "overdue").length;
          if (loans.length === 0 && reservations.length === 0) {
            return (
              <Card>
                <EmptyState
                  icon={Library}
                  title={t("lib.mine.empty")}
                  action={
                    <Button asChild>
                      <Link to="/bibliotheque">{t("lib.mine.emptyAction")}</Link>
                    </Button>
                  }
                />
              </Card>
            );
          }
          return (
            <>
              {overdue > 0 && (
                <p role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  {t("lib.mine.overdueBanner", { count: overdue })}
                </p>
              )}

              <section aria-labelledby="loans-current" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="loans-current" className="text-lg font-semibold">
                    {t("lib.mine.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t("lib.mine.quota", { used: current.length, limit })}</p>
                </div>
                {current.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lib.mine.noActive")}</p>
                ) : (
                  <ul className="space-y-3">
                    {current.map((l) => (
                      <li key={l.id}>
                        <LoanRow loan={l} busy={busyId === l.id} onRenew={(x) => void renew(x)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="loans-reservations" className="space-y-3">
                <h2 id="loans-reservations" className="text-lg font-semibold">
                  {t("lib.mine.reservations")}
                </h2>
                {reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lib.mine.noReservations")}</p>
                ) : (
                  <ul className="space-y-3">
                    {reservations.map((r) => (
                      <li key={r.id}>
                        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                              <BookMarked className="size-4 shrink-0" aria-hidden="true" />
                              {r.bookTitle}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {r.status === "ready"
                                ? t("lib.mine.reservationReady")
                                : t("lib.mine.reservationWaiting", { position: r.position ?? 1 })}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/bibliotheque/livres/${r.bookId}`} aria-label={`${t("lib.mine.openBook")} — ${r.bookTitle}`}>
                              {t("lib.mine.openBook")}
                            </Link>
                          </Button>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="loans-history" className="space-y-3">
                <h2 id="loans-history" className="text-lg font-semibold">
                  {t("lib.mine.history")}
                </h2>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lib.mine.noHistory")}</p>
                ) : (
                  <ul className="space-y-3">
                    {history.map((l) => (
                      <li key={l.id}>
                        <LoanRow loan={l} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
