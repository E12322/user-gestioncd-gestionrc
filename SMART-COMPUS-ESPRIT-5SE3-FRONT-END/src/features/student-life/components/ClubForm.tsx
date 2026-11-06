import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createClub } from "../api";
import { useViewer } from "../hooks";
import { clubSchema, fieldErrors } from "../schemas";
import { CATEGORIES, type Club, type ClubCategory } from "../types";
import { Field, fieldA11y } from "./Field";

type Errors = Partial<Record<"name" | "category" | "description" | "meetingPlace" | "maxMembers", string>>;

/** Formulaire de création de club (administrateur). 409 si le nom existe déjà. */
export function ClubForm({ onCreated, onCancel }: { onCreated: (club: Club) => void; onCancel: () => void }) {
  const t = useT();
  const viewer = useViewer();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending } = useMutation(createClub);
  const [values, setValues] = useState({
    name: "",
    category: "" as ClubCategory | "",
    description: "",
    meetingPlace: "",
    maxMembers: "30",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<string>();
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setConflict(undefined);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServiceError(undefined);
    const parsed = { ...values, maxMembers: values.maxMembers.trim() === "" ? NaN : Number(values.maxMembers) };
    const raw = fieldErrors(clubSchema, parsed);
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    try {
      const created = await mutate({ ...parsed, category: values.category as ClubCategory }, viewer);
      toast.success(t("life.form.club.created", { name: created.name }));
      onCreated(created);
    } catch (err) {
      if (isApiError(err) && err.isConflict) setConflict(err.message);
      else setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `club-${n}`;
  const bad = (k: keyof Errors) => cn(errors[k] && "border-red-600");

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {serviceError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {serviceError}
        </p>
      )}
      {conflict && <ConflictAlert title={t("life.form.club.conflictTitle")} description={conflict} />}

      <Field id={id("name")} label={t("life.form.name")} error={errors.name}>
        <Input
          id={id("name")}
          maxLength={70}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className={bad("name")}
          {...fieldA11y(id("name"), errors.name)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("category")} label={t("life.form.category")} error={errors.category}>
          <Select
            id={id("category")}
            value={values.category}
            onChange={(e) => set("category", e.target.value as ClubCategory)}
            className={bad("category")}
            {...fieldA11y(id("category"), errors.category)}
          >
            <option value="">{t("life.form.categoryPlaceholder")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("maxMembers")} label={t("life.form.maxMembers")} error={errors.maxMembers}>
          <Input
            id={id("maxMembers")}
            type="number"
            inputMode="numeric"
            min={5}
            max={500}
            value={values.maxMembers}
            onChange={(e) => set("maxMembers", e.target.value)}
            className={bad("maxMembers")}
            {...fieldA11y(id("maxMembers"), errors.maxMembers)}
          />
        </Field>
      </div>
      <Field id={id("meetingPlace")} label={t("life.form.place")} error={errors.meetingPlace}>
        <Input
          id={id("meetingPlace")}
          maxLength={70}
          value={values.meetingPlace}
          onChange={(e) => set("meetingPlace", e.target.value)}
          className={bad("meetingPlace")}
          {...fieldA11y(id("meetingPlace"), errors.meetingPlace)}
        />
      </Field>
      <Field id={id("description")} label={t("life.form.about")} error={errors.description} hint={t("life.form.aboutHint")}>
        <textarea
          id={id("description")}
          rows={3}
          maxLength={320}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={cn("flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm", bad("description"))}
          {...fieldA11y(id("description"), errors.description, t("life.form.aboutHint"))}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("life.form.submitting") : t("life.form.club.submit")}
        </Button>
      </div>
    </form>
  );
}
