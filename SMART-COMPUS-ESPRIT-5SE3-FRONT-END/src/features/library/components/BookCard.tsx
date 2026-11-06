import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { CatalogRow } from "@/shared/components/common/CatalogRow";
import { useT } from "@/shared/i18n";
import type { BookView } from "../types";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { BookActions } from "./BookActions";

interface BookCardProps {
  book: BookView;
  busy?: boolean;
  onBorrow: (book: BookView) => void;
  onReserve: (book: BookView) => void;
  onCancel: (book: BookView) => void;
}

/** Ligne du catalogue : titre, auteur, catégorie, disponibilité et action principale. */
export function BookCard({ book, busy, onBorrow, onReserve, onCancel }: BookCardProps) {
  const t = useT();
  return (
    <CatalogRow
      title={
        <Link to={`/bibliotheque/livres/${book.id}`} className="rounded hover:underline">
          {book.title}
        </Link>
      }
      badge={<AvailabilityBadge book={book} />}
      meta={[t("lib.book.by", { author: book.author }), book.category, String(book.year)]}
      extra={book.available === 0 && book.waiting > 0 ? <p>{t("lib.avail.queue", { count: book.waiting })}</p> : undefined}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/bibliotheque/livres/${book.id}`} aria-label={`${t("lib.book.details")} — ${book.title}`}>
              {t("lib.book.details")}
            </Link>
          </Button>
          <BookActions book={book} busy={busy} onBorrow={onBorrow} onReserve={onReserve} onCancel={onCancel} />
        </>
      }
    />
  );
}
