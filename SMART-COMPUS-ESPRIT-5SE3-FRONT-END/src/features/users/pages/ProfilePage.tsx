import { useRef, useState, type FormEvent } from "react";
import { Mail, Pencil, Phone, IdCard, CalendarDays, Clock, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { ServiceUnavailableView } from "@/shared/components/common/ErrorViews";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useAuth } from "@/shared/auth/AuthContext";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { formatDate, formatDateTime } from "@/shared/lib/format";
import { updateProfile } from "../api";
import { AccountStatusBadge } from "../components/AccountStatusBadge";
import { AvatarUploader } from "../components/AvatarUploader";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { TextField } from "../components/Fields";
import { LoginHistoryTable } from "../components/LoginHistoryTable";
import { useLoginHistory, useUser } from "../hooks";
import { fullName, type UserAccount } from "../types";
import { focusFirstInvalid } from "../utils/validation";

function Detail({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function ProfileForm({ account, onSaved, onCancel }: { account: UserAccount; onSaved: () => void; onCancel: () => void }) {
  const t = useT();
  const { updateUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState({ firstName: account.firstName, lastName: account.lastName, phone: account.phone ?? "" });
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string>();
  const { mutate, isPending } = useMutation(updateProfile);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const next: typeof errors = {};
    if (!v.firstName.trim()) next.firstName = t("users.err.required");
    if (!v.lastName.trim()) next.lastName = t("users.err.required");
    if (v.phone && !/^\+?[\d\s]{8,16}$/.test(v.phone)) next.phone = t("users.err.phone");
    setErrors(next);
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current);
    try {
      const saved = await mutate(account.id, v);
      updateUser({ name: fullName(saved) });
      toast.success(t("users.profile.saved"));
      onSaved();
    } catch (err) {
      setFormError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {formError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="profile-first"
          label={t("users.field.firstName")}
          value={v.firstName}
          onChange={(e) => setV({ ...v, firstName: e.target.value })}
          error={errors.firstName}
          autoComplete="given-name"
          required
        />
        <TextField
          id="profile-last"
          label={t("users.field.lastName")}
          value={v.lastName}
          onChange={(e) => setV({ ...v, lastName: e.target.value })}
          error={errors.lastName}
          autoComplete="family-name"
          required
        />
      </div>
      <TextField id="profile-email" label={t("users.field.email")} value={account.email} readOnly hint={t("users.profile.emailLocked")} />
      <TextField
        id="profile-phone"
        type="tel"
        label={t("users.field.phone")}
        placeholder="+216 20 000 000"
        value={v.phone}
        onChange={(e) => setV({ ...v, phone: e.target.value })}
        error={errors.phone}
        autoComplete="tel"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("users.pending") : t("users.profile.save")}
        </Button>
      </div>
    </form>
  );
}

/** Profil de l'utilisateur connecté : lecture, édition et historique de connexion personnel. Accessible à tous les rôles. */
export default function ProfilePage() {
  const t = useT();
  const { user } = useAuth();
  const account = useUser(user.id);
  const history = useLoginHistory({ userId: user.id });
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (account.isLoading && !account.data) {
    return (
      <div role="status" className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <span className="sr-only">{t("app.loading")}</span>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }
  if (account.error?.isUnavailable) return <ServiceUnavailableView moduleName={t("module.users")} onRetry={account.refetch} />;
  if (account.error || !account.data) {
    return (
      <Card>
        <EmptyState
          title={t("users.profile.notFound")}
          description={account.error?.message}
          action={<Button onClick={account.refetch}>{t("common.retry")}</Button>}
        />
      </Card>
    );
  }

  const a = account.data;
  return (
    <>
      <PageHeader title={t("users.profile.title")} description={t("users.profile.description")} />
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 pt-6 text-center">
            <AvatarUploader account={a} onChanged={account.refetch} />
            <p className="mt-3 text-lg font-semibold">{fullName(a)}</p>
            <p className="text-sm text-muted-foreground">{t(ROLE_LABEL[a.role])}</p>
            <div className="mt-1">
              <AccountStatusBadge status={a.status} />
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("users.profile.info")}</CardTitle>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  {t("users.profile.edit")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editing ? (
                <ProfileForm
                  account={a}
                  onCancel={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    account.refetch();
                  }}
                />
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail icon={IdCard} label={t("users.field.matricule")} value={a.id} />
                  <Detail icon={Mail} label={t("users.field.email")} value={a.email} />
                  <Detail icon={Phone} label={t("users.field.phone")} value={a.phone ?? t("users.profile.noPhone")} />
                  <Detail icon={CalendarDays} label={t("users.profile.memberSince")} value={formatDate(a.createdAt)} />
                  <Detail icon={Clock} label={t("users.profile.lastLogin")} value={a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "—"} />
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("users.password.title")}</CardTitle>
              {!changingPassword && (
                <Button variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                  <KeyRound aria-hidden="true" />
                  {t("users.password.change")}
                </Button>
              )}
            </CardHeader>
            {changingPassword && (
              <CardContent>
                <ChangePasswordForm
                  idPrefix="profile-pw"
                  onDone={() => setChangingPassword(false)}
                  onCancel={() => setChangingPassword(false)}
                />
              </CardContent>
            )}
          </Card>

          <section aria-labelledby="my-history">
            <h2 id="my-history" className="mb-3 text-lg font-semibold">
              {t("users.history.mine")}
            </h2>
            {history.error ? (
              <Card>
                <EmptyState title={t("error.generic")} action={<Button onClick={history.refetch}>{t("common.retry")}</Button>} />
              </Card>
            ) : (
              <LoginHistoryTable events={history.data} loading={history.isLoading && !history.data} pageSize={5} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
