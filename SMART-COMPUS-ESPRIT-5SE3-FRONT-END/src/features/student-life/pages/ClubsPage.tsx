import { useEffect, useState } from "react";
import { Search, Drama } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { ClubCard } from "../components/ClubCard";
import { useMembership } from "../components/useMembership";
import { useClubs } from "../hooks";
import { CATEGORIES } from "../types";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";

/** Annuaire des clubs : recherche, filtre par catégorie et adhésion. */
export default function ClubsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useClubs({ q, category });
  const { join, cancel, askLeave, pendingId, alert, dialog } = useMembership(query.refetch);
  const filtered = Boolean(q || category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="club-search" className="sr-only">
            {t("life.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="club-search"
              type="search"
              className="pl-9"
              placeholder={t("life.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="club-category" className="sr-only">
            {t("life.filter.category")}
          </label>
          <Select id="club-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("life.filter.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {alert}

      <QueryBoundary query={query} moduleName={t("module.student-life")} skeleton={<CatalogListSkeleton count={6} />}>
        {(clubs) =>
          clubs.length === 0 ? (
            <Card>
              <EmptyState icon={Drama} title={filtered ? t("life.empty.noMatch") : t("life.empty.clubs")} />
            </Card>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("life.clubs.count", { count: clubs.length })}
              </p>
              <CatalogList>
                {clubs.map((c) => (
                  <ClubCard
                    key={c.id}
                    club={c}
                    busy={pendingId === c.id}
                    onJoin={(x) => void join(x)}
                    onCancel={(x) => void cancel(x)}
                    onLeave={askLeave}
                  />
                ))}
              </CatalogList>
            </>
          )
        }
      </QueryBoundary>
      {dialog}
    </div>
  );
}
