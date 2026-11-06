import { useEffect, useState } from "react";
import { BookX, Search } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { BookCard } from "../components/BookCard";
import { useBookActions } from "../components/useBookActions";
import { useBooks } from "../hooks";
import { BOOK_CATEGORIES } from "../types";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";

/** Catalogue : recherche, filtres (catégorie, disponibilité) et actions d'emprunt ou de réservation. */
export default function CatalogPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useBooks({ q, category, availableOnly });
  const { borrow, reserve, cancel, pendingId, alert } = useBookActions(query.refetch);
  const filtered = Boolean(q || category || availableOnly);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="book-search" className="sr-only">
            {t("lib.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="book-search"
              type="search"
              className="pl-9"
              placeholder={t("lib.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="book-category" className="sr-only">
            {t("lib.filter.category")}
          </label>
          <Select id="book-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("lib.filter.allCategories")}</option>
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[hsl(var(--primary))]"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          {t("lib.filter.availableOnly")}
        </label>
      </div>

      {alert}

      <QueryBoundary query={query} moduleName={t("module.library")} skeleton={<CatalogListSkeleton count={6} />}>
        {(books) =>
          books.length === 0 ? (
            <Card>
              <EmptyState icon={BookX} title={filtered ? t("lib.empty.noMatch") : t("lib.empty.books")} />
            </Card>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("lib.books.count", { count: books.length })}
              </p>
              <CatalogList>
                {books.map((b) => (
                  <BookCard
                    key={b.id}
                    book={b}
                    busy={pendingId === b.id}
                    onBorrow={(x) => void borrow(x)}
                    onReserve={(x) => void reserve(x)}
                    onCancel={(x) => void cancel(x)}
                  />
                ))}
              </CatalogList>
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
