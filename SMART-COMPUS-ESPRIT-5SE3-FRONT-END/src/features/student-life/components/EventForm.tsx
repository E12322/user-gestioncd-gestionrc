import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createEvent } from "../api";
import { useViewer } from "../hooks";
import { eventSchema, fieldErrors } from "../schemas";
import { addDays, TIME_OPTIONS, todayISO } from "../utils/time";
import type { CampusEvent, Club } from "../types";
import { Field, fieldA11y } from "./Field";

type Errors = Partial<Record<"title" | "description" | "date" | "start" | "end" | "location", string>>;

/** Formulaire de création d'événement (administrateur), rattaché ou non à un club. */
export function EventForm({
  clubs,
  onCreated,
  onCancel,
}: {
  clubs: Club[];
  onCreated: (event: CampusEvent) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const viewer = useViewer();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending } = useMutation(createEvent);
  const [values, setValues] = useState({
    title: "",
    description: "",
    date: addDays(7),
    start: "14:00",
    end: "16:00",
    location: "",
    clubId: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServiceError(undefined);
    const raw = fieldErrors(eventSchema, { ...values, clubId: values.clubId || undefined });
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    try {
      const created = await mutate({ ...values, clubId: values.clubId || undefined }, viewer);
      toast.success(t("life.form.event.created", { title: created.title }));
      onCreated(created);
    } catch (err) {
      if (isApiError(err) && err.status === 422) setErrors({ date: err.message });
      else setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `evt-${n}`;
  const bad = (k: keyof Errors) => cn(errors[k] && "border-red-600");

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {serviceError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {serviceError}
        </p>
      )}
      <Field id={id("title")} label={t("life.form.eventTitle")} error={errors.title}>
        <Input
          id={id("title")}
          maxLength={90}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          className={bad("title")}
          {...fieldA11y(id("title"), errors.title)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={id("date")} label={t("life.form.date")} error={errors.date}>
          <Input
            id={id("date")}
            type="date"
            min={todayISO()}
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            className={bad("date")}
            {...fieldA11y(id("date"), errors.date)}
          />
        </Field>
        <Field id={id("start")} label={t("life.form.start")} error={errors.start}>
          <Select
            id={id("start")}
            value={values.start}
            onChange={(e) => set("start", e.target.value)}
            className={bad("start")}
            {...fieldA11y(id("start"), errors.start)}
          >
            {TIME_OPTIONS.slice(0, -1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={id("end")} label={t("life.form.end")} error={errors.end}>
          <Select
            id={id("end")}
            value={values.end}
            onChange={(e) => set("end", e.target.value)}
            className={bad("end")}
            {...fieldA11y(id("end"), errors.end)}
          >
            {TIME_OPTIONS.slice(1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("location")} label={t("life.form.place")} error={errors.location}>
          <Input
            id={id("location")}
            maxLength={70}
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            className={bad("location")}
            {...fieldA11y(id("location"), errors.location)}
          />
        </Field>
        <Field id={id("clubId")} label={t("life.form.club")} optional>
          <Select id={id("clubId")} value={values.clubId} onChange={(e) => set("clubId", e.target.value)}>
            <option value="">{t("life.form.noClub")}</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id={id("description")} label={t("life.form.eventDescription")} error={errors.description} optional>
        <textarea
          id={id("description")}
          rows={2}
          maxLength={220}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={cn("flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm", bad("description"))}
          {...fieldA11y(id("description"), errors.description)}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("life.form.submitting") : t("life.form.event.submit")}
        </Button>
      </div>
    </form>
  );
}
