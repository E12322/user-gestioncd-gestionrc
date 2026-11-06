import { Fragment, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { ServiceUnavailableView } from "@/shared/components/common/ErrorViews";
import { isApiError } from "@/shared/api/errors";
import { ROLES, ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { setPermission } from "../api";
import { usePermissions } from "../hooks";
import type { PermissionMatrix } from "../types";

/** Les droits d'administration des comptes ne peuvent pas être retirés au rôle Administrateur. */
const isLocked = (role: Role, key: string) => role === "admin" && key.startsWith("users.");

export default function RolesMatrixPage() {
  const t = useT();
  const { data, error, isLoading, refetch } = usePermissions();
  const [matrix, setMatrix] = useState<PermissionMatrix["matrix"]>();

  useEffect(() => {
    if (data) setMatrix(data.matrix);
  }, [data]);

  async function toggle(role: Role, key: string, label: string, granted: boolean) {
    const previous = matrix;
    setMatrix((m) => m && { ...m, [role]: { ...m[role], [key]: granted } }); // mise à jour optimiste
    try {
      await setPermission(role, key, granted);
      toast.success(t(granted ? "users.matrix.granted" : "users.matrix.revoked", { role: t(ROLE_LABEL[role]), permission: label }));
    } catch (e) {
      setMatrix(previous);
      toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    }
  }

  if (error?.isUnavailable) return <ServiceUnavailableView moduleName={t("module.users")} onRetry={refetch} />;
  if (error) {
    return (
      <Card>
        <EmptyState
          title={t("error.generic")}
          description={error.message}
          action={<Button onClick={refetch}>{t("common.retry")}</Button>}
        />
      </Card>
    );
  }
  if (isLoading || !data || !matrix) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">{t("app.loading")}</span>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const groups = [...new Set(data.permissions.map((p) => p.group))];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("users.matrix.help")}</p>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">{t("users.matrix.caption")}</caption>
          <thead className="border-b bg-secondary/60">
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-72 bg-secondary px-4 py-3 font-semibold text-muted-foreground">
                {t("users.matrix.permission")}
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="px-3 py-3 text-center font-semibold text-muted-foreground">
                  {t(ROLE_LABEL[r])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="bg-slate-50">
                  <th
                    scope="colgroup"
                    colSpan={ROLES.length + 1}
                    className="sticky left-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group}
                  </th>
                </tr>
                {data.permissions
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <tr key={p.key} className="border-t">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 font-medium">
                        {p.label}
                      </th>
                      {ROLES.map((r) => {
                        const locked = isLocked(r, p.key);
                        return (
                          <td key={r} className="px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1">
                              <Switch
                                checked={matrix[r][p.key] ?? false}
                                disabled={locked}
                                aria-label={`${t(ROLE_LABEL[r])} — ${p.label}`}
                                title={locked ? t("users.matrix.locked") : undefined}
                                onCheckedChange={(v) => void toggle(r, p.key, p.label, v)}
                              />
                              {locked && (
                                <>
                                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                  <span className="sr-only">{t("users.matrix.locked")}</span>
                                </>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
