import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { focusFirstInvalid, INSTITUTIONAL_DOMAIN } from "../../utils/validation";
import { forgotPassword } from "../api.mock";
import { AttemptAlert } from "../components/AttemptAlert";
import { AuthShell } from "../components/AuthShell";
import { CountdownButton } from "../components/CountdownButton";
import { EmailField } from "../components/EmailField";
import { forgotSchema, validate } from "../schemas";

export default function ForgotPasswordPage() {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [token] = useState(() => Math.random().toString(36).slice(2, 10));
  const { mutate, isPending } = useMutation(forgotPassword);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const v = validate(forgotSchema, { email });
    if (v.errors) {
      setError(v.errors.email);
      return focusFirstInvalid(formRef.current);
    }
    try {
      await mutate(v.data.email);
      setSent(true);
    } catch (e) {
      setFormError(isApiError(e) && e.isUnavailable ? t("error.unavailable.title") : t("error.generic"));
    }
  }

  if (sent) {
    return (
      <AuthShell title={t("users.forgot.sentTitle")}>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-blue-50 text-navy">
            <MailCheck className="size-8" aria-hidden="true" />
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {t("users.forgot.sentBody", { email })}
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to={`/reinitialiser-mot-de-passe?token=${token}&email=${encodeURIComponent(email.trim().toLowerCase())}`}>
              {t("users.forgot.openLink")}
            </Link>
          </Button>
          <CountdownButton
            variant="outline"
            size="lg"
            className="w-full"
            startCounting
            label={t("users.verify.resend")}
            countdownLabel={(s) => t("users.verify.resendIn", { seconds: s })}
            onClick={() => forgotPassword(email)}
          />
          <Link to="/connexion" className="inline-block rounded text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("users.forgot.backToLogin")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("users.forgot.title")} description={t("users.forgot.description")}>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-1">
        {formError && <AttemptAlert kind="error" message={formError} />}
        <div className={formError ? "pt-4" : undefined}>
          <EmailField
            id="forgot-email"
            autoFocus
            value={email}
            onChange={(v) => {
              setEmail(v);
              setError(undefined);
            }}
            error={error ? t(error, { domain: INSTITUTIONAL_DOMAIN }) : undefined}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isPending} aria-busy={isPending || undefined}>
          {isPending ? t("users.pending") : t("users.forgot.submit")}
        </Button>
        <p className="pt-4 text-center">
          <Link to="/connexion" className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("users.forgot.backToLogin")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
