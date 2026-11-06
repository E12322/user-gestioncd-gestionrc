import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import type { Role } from "@/shared/auth/roles";
import { useT } from "@/shared/i18n";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { createUserByAdmin } from "../api";
import { focusFirstInvalid, INSTITUTIONAL_DOMAIN, isInstitutionalEmail } from "../utils/validation";
import type { AdminCreateResult } from "../types";
import { RoleSelect, TextField } from "./Fields";

interface Props {
  roles: readonly Role[];
  submitLabel: string;
  onCreated: (result: AdminCreateResult) => void;
  idPrefix?: string;
  extraActions?: ReactNode;
}

type Errors = Partial<Record<"firstName" | "lastName" | "email", string>>;

/**
 * Création d'un compte par un administrateur. Aucun mot de passe n'est saisi : le service génère un mot de passe
 * temporaire et l'envoie par e-mail ; la personne le remplace dès sa première connexion. Règle : un e-mail = un compte.
 */
export function AccountForm({ roles, submitLabel, onCreated, idPrefix = "acc", extraActions }: Props) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", role: roles[0]! });
  const [errors, setErrors] = useState<Errors>({});
  const [serviceError, setServiceError] = useState<string>();
  const { mutate, isPending } = useMutation(createUserByAdmin);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServiceError(undefined);
    const next: Errors = {};
    if (!values.firstName.trim()) next.firstName = t("users.err.required");
    if (!values.lastName.trim()) next.lastName = t("users.err.required");
    if (!values.email.trim()) next.email = t("users.err.required");
    else if (!isInstitutionalEmail(values.email)) next.email = t("users.err.emailDomain", { domain: INSTITUTIONAL_DOMAIN });
    setErrors(next);
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current);

    try {
      onCreated(await mutate({ firstName: values.firstName, lastName: values.lastName, email: values.email, role: values.role }));
    } catch (err) {
      if (isApiError(err) && err.isConflict) {
        setErrors({ email: t("users.err.emailExists") });
        focusFirstInvalid(formRef.current);
      } else if (isApiError(err) && err.isUnavailable) setServiceError(t("error.unavailable.title"));
      else setServiceError(isApiError(err) ? err.message : t("error.generic"));
    }
  }

  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {serviceError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {serviceError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={id("first")}
          label={t("users.field.firstName")}
          value={values.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          error={errors.firstName}
          autoComplete="off"
          required
        />
        <TextField
          id={id("last")}
          label={t("users.field.lastName")}
          value={values.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          error={errors.lastName}
          autoComplete="off"
          required
        />
      </div>
      <TextField
        id={id("email")}
        type="email"
        label={t("users.field.email")}
        placeholder={`prenom.nom@${INSTITUTIONAL_DOMAIN}`}
        value={values.email}
        onChange={(e) => set("email", e.target.value)}
        error={errors.email}
        autoComplete="off"
        required
      />
      <RoleSelect id={id("role")} label={t("users.field.role")} value={values.role} onChange={(r) => set("role", r)} roles={roles} />
      <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("users.create.noPassword")}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {extraActions}
        <Button type="submit" disabled={isPending}>
          {isPending ? t("users.pending") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
