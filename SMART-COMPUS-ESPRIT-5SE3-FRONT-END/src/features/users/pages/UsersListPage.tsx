import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, UserCheck, UserCog, UserPlus, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { ServiceUnavailableView } from "@/shared/components/common/ErrorViews";
import { StatCard } from "@/shared/components/common/StatCard";
import { isApiError } from "@/shared/api/errors";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLES, ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { initials } from "@/shared/lib/utils";
import { changeRole, deleteUser, setStatus } from "../api";
import { AccountCreatedDialog } from "../components/AccountCreatedDialog";
import { AccountForm } from "../components/AccountForm";
import { AccountStatusBadge } from "../components/AccountStatusBadge";
import { RoleSelect } from "../components/Fields";
import { useUsers } from "../hooks";
import { fullName, type AccountStatus, type AdminCreateResult, type UserAccount } from "../types";
import { MAX_ATTEMPTS } from "../utils/validation";

type Pending = { kind: "activate" | "deactivate" | "delete"; account: UserAccount };

export default function UsersListPage() {
  const t = useT();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatusFilter] = useState<AccountStatus | "">("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<AdminCreateResult | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, error, isLoading, refetch } = useUsers({ q, role, status });

  const errorToast = (e: unknown) =>
    toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));

  async function onRoleChange(account: UserAccount, next: Role) {
    try {
      await changeRole(account.id, next);
      refetch();
    } catch (e) {
      errorToast(e);
      refetch(); // remet le sélecteur sur la valeur réelle
    }
  }

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    try {
      const { kind, account } = pending;
      if (kind === "delete") await deleteUser(account.id);
      else await setStatus(account.id, kind === "activate" ? "active" : "inactive");
      toast.success(t(`users.toast.${kind}`, { name: fullName(account) }));
      setPending(null);
      refetch();
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<Column<UserAccount>[]>(
    () => [
      {
        key: "name",
        header: t("users.col.user"),
        sortValue: (u) => fullName(u),
        cell: (u) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">{initials(fullName(u))}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{fullName(u)}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
          </div>
        ),
      },
      { key: "id", header: t("users.field.matricule"), sortValue: (u) => u.id, cell: (u) => <code className="text-xs">{u.id}</code> },
      {
        key: "role",
        header: t("users.field.role"),
        sortValue: (u) => t(ROLE_LABEL[u.role]),
        cell: (u) => (
          <RoleSelect
            id={`role-${u.id}`}
            label={`${t("users.field.role")} — ${fullName(u)}`}
            hideLabel
            value={u.role}
            roles={ROLES}
            disabled={u.id === me.id}
            onChange={(r) => void onRoleChange(u, r)}
            className="min-w-[10.5rem]"
          />
        ),
      },
      {
        key: "status",
        header: t("users.col.status"),
        sortValue: (u) => u.status,
        cell: (u) => (
          <div className="space-y-1">
            <AccountStatusBadge status={u.status} />
            {u.failedAttempts > 0 && (
              <p className="text-xs text-muted-foreground">{t("users.lock.counter", { attempts: u.failedAttempts, max: MAX_ATTEMPTS })}</p>
            )}
          </div>
        ),
      },
      {
        key: "last",
        header: t("users.profile.lastLogin"),
        sortValue: (u) => u.lastLoginAt ?? "",
        cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"),
      },
      {
        key: "actions",
        header: t("users.col.actions"),
        cell: (u) => {
          const self = u.id === me.id;
          const name = fullName(u);
          const toggle = u.status === "active" ? "deactivate" : "activate";
          return (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={self}
                title={self ? t("users.action.self") : t(`users.action.${toggle}`)}
                aria-label={`${t(`users.action.${toggle}`)} — ${name}`}
                onClick={() => setPending({ kind: toggle, account: u })}
              >
                {toggle === "deactivate" ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={self}
                title={self ? t("users.action.self") : t("users.action.delete")}
                aria-label={`${t("users.action.delete")} — ${name}`}
                className="text-red-700 hover:bg-red-50"
                onClick={() => setPending({ kind: "delete", account: u })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, me.id],
  );

  if (error?.isUnavailable) return <ServiceUnavailableView moduleName={t("module.users")} onRetry={refetch} />;
  if (error && !data) {
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

  const stats = data?.stats;
  const filtered = Boolean(q || role || status);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("users.stats.total")} value={stats?.total ?? "—"} icon={Users} tone="navy" />
        <StatCard label={t("users.stats.active")} value={stats?.active ?? "—"} icon={UserCheck} tone="green" />
        <StatCard label={t("users.stats.inactive")} value={stats?.inactive ?? "—"} icon={UserCog} tone="blue" />
        <StatCard label={t("users.stats.suspended")} value={stats?.suspended ?? "—"} icon={UserX} tone="red" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="users-search" className="sr-only">
            {t("users.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="users-search"
              type="search"
              className="pl-9"
              placeholder={t("users.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="filter-role" className="sr-only">
            {t("users.filter.role")}
          </label>
          <Select id="filter-role" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
            <option value="">{t("users.filter.allRoles")}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="filter-status" className="sr-only">
            {t("users.filter.status")}
          </label>
          <Select id="filter-status" value={status} onChange={(e) => setStatusFilter(e.target.value as AccountStatus | "")}>
            <option value="">{t("users.filter.allStatuses")}</option>
            {(["active", "inactive", "suspended"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`users.status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus aria-hidden="true" />
          {t("users.create")}
        </Button>
      </div>

      <div aria-live="polite" className="sr-only">
        {data && t("table.rows", { count: data.items.length })}
      </div>
      <DataTable
        caption={t("users.list.caption")}
        columns={columns}
        data={data?.items}
        rowKey={(u) => u.id}
        loading={isLoading && !data}
        emptyTitle={filtered ? t("users.list.noMatch") : t("users.list.empty")}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && !busy && setPending(null)}
        destructive={pending?.kind !== "activate"}
        loading={busy}
        title={pending ? t(`users.confirm.${pending.kind}.title`, { name: fullName(pending.account) }) : ""}
        description={pending ? t(`users.confirm.${pending.kind}.body`) : undefined}
        confirmLabel={pending ? t(`users.action.${pending.kind}`) : undefined}
        onConfirm={confirmPending}
      />

      <AccountCreatedDialog result={created} onClose={() => setCreated(null)} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <div className="space-y-1">
            <DialogTitle>{t("users.create")}</DialogTitle>
            <DialogDescription>{t("users.create.description")}</DialogDescription>
          </div>
          <AccountForm
            roles={ROLES}
            idPrefix="admin-create"
            submitLabel={t("users.create.submit")}
            onCreated={(result) => {
              setCreating(false);
              setCreated(result);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
