import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import type { BookView } from "../types";

/** Disponibilité d'un ouvrage, toujours écrite en toutes lettres (pas seulement la couleur). */
export function AvailabilityBadge({ book, className }: { book: BookView; className?: string }) {
  const t = useT();
  const mine = book.myReservation;
  let cls = "bg-red-100 text-red-800 border-red-200";
  let label = t("lib.avail.none");

  if (book.myLoanId) {
    cls = "bg-blue-100 text-blue-900 border-blue-200";
    label = t("lib.avail.borrowed");
  } else if (mine?.status === "ready") {
    cls = "bg-green-100 text-green-800 border-green-200";
    label = t("lib.avail.ready");
  } else if (mine?.status === "waiting") {
    cls = "bg-amber-100 text-amber-900 border-amber-200";
    label = t("lib.avail.waiting", { position: mine.position ?? 1 });
  } else if (book.available > 0) {
    cls = "bg-green-100 text-green-800 border-green-200";
    label = t("lib.avail.available", { free: book.available, copies: book.copies });
  }

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls, className)}>{label}</span>
  );
}
