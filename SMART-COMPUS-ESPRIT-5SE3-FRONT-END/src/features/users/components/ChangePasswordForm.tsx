import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { changePassword } from "../api";
import { PasswordInput } from "../auth/components/PasswordInput";
import { focusFirstInvalid, passwordError } from "../utils/validation";

interface Props {
  /** Première connexion avec mot de passe temporaire : libellé adapté. */
  forced?: boolean;
  idPrefix?: string;
  onDone: () => void;
  onCancel?: () => void;
}

type Errors = Partial<Record<"current" | "next" | "confirm", string>>;

/**
 * Changement de mot de passe : demande l'actuel (ou le temporaire), refuse un nouveau mot de passe identique
 * à l'ancien ou trop faible, et exige la confirmation.
 */
export function ChangePasswordForm({ forced, idPrefix = "pw", onDone, onCancel }: Props) {
  const t = useT();
  const { user, updateUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const { mutate, isPending } = useMutation(changePassword);

  const set = <K extends keyof typeof v>(k: K, value: string) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const next: Errors = {};
    if (!v.current) next.current = t("users.err.required");
    const weak = passwordError(v.next);
    if (weak) next.next = t(weak);
    else if (v.next === v.current) next.next = t("users.err.passwordSame");
    if (v.confirm !== v.next) next.confirm = t("users.err.passwordMismatch");
    setErrors(next);
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current);

    try {
      await mutate(user.id, v.current, v.next);
      updateUser({ mustChangePassword: false });
      toast.success(t("users.password.saved"));
      onDone();
    } catch (err) {
      const code = isApiError(err) ? (err.details as { code?: string } | undefined)?.code : undefined;
      if (code === "WRONG_PASSWORD") {
        setErrors({ current: t("users.password.wrongCurrent") });
        focusFirstInvalid(formRef.current);
      } else if (code === "SAME_PASSWORD") {
        setErrors({ next: t("users.err.passwordSame") });
        focusFirstInvalid(formRef.current);
      } else setFormError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-1">
      {formError && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {formError}
        </p>
      )}
      <PasswordInput
        id={id("current")}
        label={forced ? t("users.force.current") : t("users.password.current")}
        autoComplete="current-password"
        autoFocus={forced}
        value={v.current}
        onChange={(x) => set("current", x)}
        error={errors.current}
      />
      <PasswordInput
        id={id("next")}
        label={t("users.password.new")}
        autoComplete="new-password"
        showStrength
        value={v.next}
        onChange={(x) => set("next", x)}
        error={errors.next}
        hint={t("users.password.rules")}
      />
      <PasswordInput
        id={id("confirm")}
        label={t("users.password.confirmNew")}
        autoComplete="new-password"
        value={v.confirm}
        onChange={(x) => set("confirm", x)}
        error={errors.confirm}
      />
      <div className="flex flex-wrap justify-end gap-2 pt-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit" size={forced ? "lg" : "default"} className={forced ? "w-full" : undefined} disabled={isPending}>
          {isPending ? t("users.pending") : forced ? t("users.force.submit") : t("users.password.save")}
        </Button>
      </div>
    </form>
  );
}
