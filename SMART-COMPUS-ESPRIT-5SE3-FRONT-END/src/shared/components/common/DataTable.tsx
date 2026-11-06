import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "./EmptyState";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valeur de tri ; si absente, la colonne n'est pas triable. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, data, rowKey, caption, loading, pageSize = 8, emptyTitle, onRowClick }: DataTableProps<T>) {
  const t = useT();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!data) return [];
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return data;
    const sv = col.sortValue;
    return [...data].sort((a, b) => {
      const [x, y] = [sv(a), sv(b)];
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr");
      return sort.dir === "asc" ? r : -r;
    });
  }, [data, columns, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, (current + 1) * pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="overflow-x-auto" aria-busy={loading || undefined}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b bg-secondary/60">
            <tr>
              {columns.map((c) => {
                const sorted = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined}
                    className={cn("px-4 py-3 font-semibold text-muted-foreground", c.className)}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 rounded hover:text-foreground"
                      >
                        {c.header}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton className="h-5 w-full max-w-[10rem]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn("hover:bg-secondary/50", onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3", c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 && <EmptyState title={emptyTitle ?? t("table.empty")} />}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>{t("table.rows", { count: rows.length })}</span>
          <div className="flex items-center gap-2">
            <span>{t("table.page", { page: current + 1, total: pages })}</span>
            <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              {t("table.prev")}
            </Button>
            <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
