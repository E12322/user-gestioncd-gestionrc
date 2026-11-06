import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { ROLES, ROLE_LABEL } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { focusFirstInvalid, INSTITUTIONAL_DOMAIN, MAX_ATTEMPTS } from "../../utils/validation";
import { login } from "../api.mock";
import { useAuth } from "@/shared/auth/AuthContext";
import { AttemptAlert } from "../components/AttemptAlert";
import { AuthShell } from "../components/AuthShell";
import { EmailField } from "../components/EmailField";
import { PasswordInput } from "../components/PasswordInput";
import { loginSchema, validate, type FieldErrors } from "../schemas";

type Failure = { kind: "attempts"; attempts: number } | { kind: "locked"; attempts: number } | { kind: "error"; message: string };

export default function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { login: openSession } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<{ email: string; password: string }>>({});
  const [failure, setFailure] = useState<Failure>();
  const { mutate, isPending } = useMutation(login);

  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const locked = failure?.kind === "locked";
  const err = (k?: string) => (k ? t(k, { domain: INSTITUTIONAL_DOMAIN }) : undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(undefined);
    const v = validate(loginSchema, { email, password });
    if (v.errors) {
      setErrors(v.errors);
      return focusFirstInvalid(formRef.current);
    }
    setErrors({});
    try {
      const { user, token } = await mutate(v.data.email.trim().toLowerCase(), v.data.password);
      openSession(user, token);
      toast.success(t("users.login.welcome", { name: user.name }));
      navigate(user.mustChangePassword ? "/changer-mot-de-passe" : from, { replace: true });
    } catch (e) {
      if (!isApiError(e)) return setFailure({ kind: "error", message: t("error.generic") });
      const attempts = (e.details as { failedAttempts?: number } | undefined)?.failedAttempts;
      if (e.status === 423) setFailure({ kind: "locked", attempts: attempts ?? MAX_ATTEMPTS });
      else if (e.status === 401 && attempts) setFailure({ kind: "attempts", attempts });
      else if (e.status === 401) setFailure({ kind: "error", message: t("users.login.invalid") });
      else if (e.status === 403 && (e.details as { code?: string } | undefined)?.code === "EMAIL_NOT_VERIFIED") {
        setFailure({ kind: "error", message: t("users.login.unverified") });
      } else if (e.status === 403) setFailure({ kind: "error", message: t("users.login.inactive") });
      else setFailure({ kind: "error", message: e.isUnavailable ? t("error.unavailable.title") : e.message });
    }
  }

  return (
    <AuthShell
      title={t("users.login.title")}
      description={t("users.login.description")}
      footer={
        <section aria-labelledby="demo-login" className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-4">
          <h2 id="demo-login" className="text-sm font-semibold text-amber-950">
            {t("users.login.demo")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <Button key={r} type="button" size="sm" variant="outline" className="bg-white" disabled title={t("users.login.demoDisabled")}>
                {t(ROLE_LABEL[r])}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-950">{t("users.login.demoDisabled")}</p>
          <p className="text-xs text-amber-950">{t("users.login.demoReal")}</p>
        </section>
      }
    >
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate method="post" className="space-y-1">
        {failure?.kind === "attempts" && (
          <AttemptAlert kind="warning" attempts={failure.attempts} max={MAX_ATTEMPTS} message={t("users.login.invalid")} />
        )}
        {failure?.kind === "locked" && <AttemptAlert kind="locked" attempts={failure.attempts} max={MAX_ATTEMPTS} />}
        {failure?.kind === "error" && <AttemptAlert kind="error" message={failure.message} />}
        <div className={failure ? "pt-4" : undefined}>
          <EmailField
            id="login-email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(v) => {
              setEmail(v);
              setErrors((x) => ({ ...x, email: undefined }));
            }}
            error={err(errors.email)}
          />
          <PasswordInput
            id="login-password"
            label={t("users.field.password")}
            autoComplete="current-password"
            value={password}
            disabled={locked}
            onChange={(v) => {
              setPassword(v);
              setErrors((x) => ({ ...x, password: undefined }));
            }}
            error={err(errors.password)}
          />
        </div>
        <div className="flex justify-end pb-2">
          <Link to="/mot-de-passe-oublie" className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("users.login.forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isPending || locked} aria-busy={isPending || undefined}>
          {isPending ? t("users.pending") : t("users.login.submit")}
        </Button>
        <p className="pt-4 text-center text-sm text-muted-foreground">
          {t("users.login.noAccount")}{" "}
          <Link to="/inscription" className="rounded font-medium text-primary underline-offset-4 hover:underline">
            {t("users.register.title")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
