import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { AvailabilityBadge } from "../components/AvailabilityBadge";
import { BookActions } from "../components/BookActions";
import { useBookActions } from "../components/useBookActions";
import { useBook } from "../hooks";

/** Fiche d'un ouvrage : résumé, disponibilité des exemplaires, emprunt ou réservation. */
export default function BookDetailPage() {
  const t = useT();
  const { id = "" } = useParams();
  const query = useBook(id);
  const { borrow, reserve, cancel, pendingId, alert } = useBookActions(query.refetch);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/bibliotheque">
          <ArrowLeft aria-hidden="true" />
          {t("lib.back")}
        </Link>
      </Button>

      {alert}

      <QueryBoundary query={query} moduleName={t("module.library")} skeleton={<Skeleton className="h-64 w-full rounded-xl" />}>
        {(book) => (
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {book.category} · {book.year}
                </p>
                <h2 className="text-2xl font-bold tracking-tight">{book.title}</h2>
                <p className="text-muted-foreground">{t("lib.book.by", { author: book.author })}</p>
              </div>
              <AvailabilityBadge book={book} />
            </div>

            {book.description && (
              <section aria-labelledby="book-about">
                <h3 id="book-about" className="mb-1 text-sm font-semibold">
                  {t("lib.book.about")}
                </h3>
                <p className="text-sm">{book.description}</p>
              </section>
            )}

            <p className="text-sm text-muted-foreground">
              {t("lib.book.isbn", { isbn: book.isbn })} · {t("lib.book.copies", { count: book.copies })}
            </p>
            <CapacityGauge
              used={book.copies - book.available}
              capacity={book.copies}
              label={t("lib.avail.available", { free: book.available, copies: book.copies })}
              className="max-w-sm"
            />
            {book.available === 0 && book.waiting > 0 && (
              <p className="text-sm text-muted-foreground">{t("lib.avail.queue", { count: book.waiting })}</p>
            )}

            <BookActions
              book={book}
              busy={pendingId === book.id}
              onBorrow={(x) => void borrow(x)}
              onReserve={(x) => void reserve(x)}
              onCancel={(x) => void cancel(x)}
            />
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}
