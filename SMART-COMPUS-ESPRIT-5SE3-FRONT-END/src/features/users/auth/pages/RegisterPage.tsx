import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { focusFirstInvalid, INSTITUTIONAL_DOMAIN } from "../../utils/validation";
import { register } from "../api.mock";
import { AttemptAlert } from "../components/AttemptAlert";
import { AuthShell } from "../components/AuthShell";
import { EmailField } from "../components/EmailField";
import { Field, inputClass, messageId } from "../components/Field";
import { PasswordInput } from "../components/PasswordInput";
import { registerSchema, validate, type FieldErrors } from "../schemas";

type Values = { firstName: string; lastName: string; email: string; password: string; confirm: string };

/** Auto-inscription réservée aux étudiants : les comptes enseignants et administrateurs sont créés par un administrateur. */
export default function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState<Values>({ firstName: "", lastName: "", email: params.get("email") ?? "", password: "", confirm: "" });
  const [errors, setErrors] = useState<FieldErrors<Values>>({});
  const [formError, setFormError] = useState<string>();
  const { mutate, isPending } = useMutation(register);

  const set = <K extends keyof Values>(k: K, value: Values[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const err = (k?: string) => (k ? t(k, { domain: INSTITUTIONAL_DOMAIN }) : undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const r = validate(registerSchema, v);
    if (r.errors) {
      setErrors(r.errors);
      return focusFirstInvalid(formRef.current);
    }
    try {
      const acct = await mutate({
        firstName: r.data.firstName,
        lastName: r.data.lastName,
        email: r.data.email,
        role: "student",
        password: r.data.password,
      });
      navigate(`/verification-email?email=${encodeURIComponent(acct.email)}`);
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setErrors({ email: "users.err.emailExists" });
        focusFirstInvalid(formRef.current);
      } else setFormError(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    }
  }

  return (
    <AuthShell title={t("users.register.title")} description={t("users.register.description")}>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate method="post" className="space-y-1">
        {formError && <AttemptAlert kind="error" message={formError} />}
        <div className={formError ? "pt-4" : undefined}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field id="reg-first" label={t("users.field.firstName")} required error={err(errors.firstName)}>
              <input
                id="reg-first"
                name="given-name"
                autoComplete="given-name"
                required
                value={v.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                aria-invalid={errors.firstName ? true : undefined}
                aria-describedby={messageId("reg-first")}
                className={inputClass(Boolean(errors.firstName))}
              />
            </Field>
            <Field id="reg-last" label={t("users.field.lastName")} required error={err(errors.lastName)}>
              <input
                id="reg-last"
                name="family-name"
                autoComplete="family-name"
                required
                value={v.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                aria-invalid={errors.lastName ? true : undefined}
                aria-describedby={messageId("reg-last")}
                className={inputClass(Boolean(errors.lastName))}
              />
            </Field>
          </div>
          <EmailField
            id="reg-email"
            value={v.email}
            onChange={(x) => set("email", x)}
            error={
              errors.email && (
                <>
                  {err(errors.email)}
                  {errors.email === "users.err.emailExists" && (
                    <>
                      {" "}
                      <Link to="/connexion" className="font-medium underline">
                        {t("users.login.submit")}
                      </Link>
                    </>
                  )}
                </>
              )
            }
          />
          <PasswordInput
            id="reg-password"
            label={t("users.field.password")}
            autoComplete="new-password"
            showStrength
            value={v.password}
            onChange={(x) => set("password", x)}
            error={err(errors.password)}
            hint={t("users.password.rules")}
          />
          <PasswordInput
            id="reg-confirm"
            name="confirm-password"
            label={t("users.field.confirmPassword")}
            autoComplete="new-password"
            value={v.confirm}
            onChange={(x) => set("confirm", x)}
            error={err(errors.confirm)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isPending} aria-busy={isPending || undefined}>
          {isPending ? t("users.pending") : t("users.register.submit")}
        </Button>
        <p className="pt-4 text-center text-sm text-muted-foreground">
          {t("users.register.hasAccount")}{" "}
          <Link to="/connexion" className="rounded font-medium text-primary underline-offset-4 hover:underline">
            {t("users.login.submit")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
