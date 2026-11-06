import { useState } from "react";
import { toast } from "sonner";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { borrowBook, cancelReservation, reserveBook } from "../api";
import { useViewer } from "../hooks";
import { formatDay } from "../utils/time";
import type { BookView } from "../types";

interface ConflictState {
  book: BookView;
  message: string;
  conflicts: string[];
}

/**
 * Actions d'ouvrage partagées (catalogue + fiche) : emprunter, réserver, annuler une réservation,
 * avec toast de succès et ConflictAlert sur 409 (indisponible, retard, plafond, doublon).
 */
export function useBookActions(onDone: () => void) {
  const t = useT();
  const viewer = useViewer();
  const [pendingId, setPendingId] = useState<string>();
  const [conflict, setConflict] = useState<ConflictState>();

  async function run(book: BookView, action: () => Promise<string>) {
    setConflict(undefined);
    setPendingId(book.id);
    try {
      toast.success(await action());
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setConflict({ book, message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      } else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setPendingId(undefined);
      onDone();
    }
  }

  const alert = conflict && (
    <ConflictAlert
      title={t("lib.action.conflictTitle", { title: conflict.book.title })}
      description={conflict.message}
      conflicts={conflict.conflicts}
      action={
        <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
          {t("common.close")}
        </button>
      }
    />
  );

  return {
    borrow: (book: BookView) =>
      run(book, async () => {
        const loan = await borrowBook(book.id, viewer);
        return t("lib.action.borrowedOk", { title: book.title, date: formatDay(loan.dueDate) });
      }),
    reserve: (book: BookView) =>
      run(book, async () => {
        const r = await reserveBook(book.id, viewer);
        return t("lib.action.reservedOk", { title: book.title, position: r.position ?? 1 });
      }),
    cancel: (book: BookView) =>
      run(book, async () => {
        await cancelReservation(book.myReservation!.id, viewer);
        return t("lib.action.cancelledOk", { title: book.title });
      }),
    pendingId,
    alert,
  };
}
