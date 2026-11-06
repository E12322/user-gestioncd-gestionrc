import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { focusFirstInvalid } from "../../utils/validation";
import { resetPassword } from "../api.mock";
import { AttemptAlert } from "../components/AttemptAlert";
import { AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { resetSchema, validate, type FieldErrors } from "../schemas";

export default function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Le jeton est lu une fois, puis retiré de la barre d'adresse (historique, captures d'écran, en-tête Referer).
  const [{ token, email }] = useState(() => ({ token: params.get("token") ?? "", email: params.get("email") ?? "" }));
  useEffect(() => {
    if (window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors<{ password: string; confirm: string }>>({});
  const [formError, setFormError] = useState<string>();
  const { mutate, isPending } = useMutation(resetPassword);

  if (!token || !email) {
    return (
      <AuthShell title={t("users.reset.invalidTitle")}>
        <p role="alert" className="text-sm text-muted-foreground">
          {t("users.reset.invalidBody")}
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link to="/mot-de-passe-oublie">{t("users.forgot.title")}</Link>
        </Button>
      </AuthShell>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const v = validate(resetSchema, { password, confirm });
    if (v.errors) {
      setErrors(v.errors);
      return focusFirstInvalid(formRef.current);
    }
    try {
      await mutate(email, token, v.data.password);
      toast.success(t("users.reset.done"));
      navigate("/connexion");
    } catch (e) {
      setFormError(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    }
  }

  return (
    <AuthShell title={t("users.reset.title")} description={t("users.reset.description", { email })}>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate method="post" className="space-y-1">
        {/* Champ identifiant masqué : permet au gestionnaire de mots de passe de mettre à jour le bon compte. */}
        <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
        {formError && <AttemptAlert kind="error" message={formError} />}
        <div className={formError ? "pt-4" : undefined}>
          <PasswordInput
            id="reset-pw"
            label={t("users.reset.newPassword")}
            autoComplete="new-password"
            autoFocus
            showStrength
            value={password}
            onChange={(v) => {
              setPassword(v);
              setErrors((x) => ({ ...x, password: undefined }));
            }}
            error={errors.password ? t(errors.password) : undefined}
            hint={t("users.password.rules")}
          />
          <PasswordInput
            id="reset-confirm"
            name="confirm-password"
            label={t("users.field.confirmPassword")}
            autoComplete="new-password"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setErrors((x) => ({ ...x, confirm: undefined }));
            }}
            error={errors.confirm ? t(errors.confirm) : undefined}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isPending} aria-busy={isPending || undefined}>
          {isPending ? t("users.pending") : t("users.reset.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
