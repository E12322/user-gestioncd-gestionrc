import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useT } from "@/shared/i18n";
import type { BookView } from "../types";

interface BookActionsProps {
  book: BookView;
  busy?: boolean;
  onBorrow: (book: BookView) => void;
  onReserve: (book: BookView) => void;
  onCancel: (book: BookView) => void;
}

/** Bouton principal selon l'état : Emprunter / Réserver / Annuler la réservation / Prêt en cours. */
export function BookActions({ book, busy, onBorrow, onReserve, onCancel }: BookActionsProps) {
  const t = useT();
  const label = (key: string) => `${t(key)} — ${book.title}`;

  if (book.myLoanId) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/bibliotheque/mes-prets">{t("lib.action.borrowed")}</Link>
      </Button>
    );
  }
  if (book.myReservation?.status === "ready") {
    return (
      <Button size="sm" disabled={busy} onClick={() => onBorrow(book)} aria-label={label("lib.action.borrowReady")}>
        {t("lib.action.borrowReady")}
      </Button>
    );
  }
  if (book.myReservation?.status === "waiting") {
    return (
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onCancel(book)} aria-label={label("lib.action.cancelReservation")}>
        {t("lib.action.cancelReservation")}
      </Button>
    );
  }
  if (book.available > 0) {
    return (
      <Button size="sm" disabled={busy} onClick={() => onBorrow(book)} aria-label={label("lib.action.borrow")}>
        {t("lib.action.borrow")}
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="sm" disabled={busy} onClick={() => onReserve(book)} aria-label={label("lib.action.reserve")}>
      {t("lib.action.reserve")}
    </Button>
  );
}
