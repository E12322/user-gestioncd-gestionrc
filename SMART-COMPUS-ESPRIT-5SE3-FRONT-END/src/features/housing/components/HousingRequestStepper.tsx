import { useRef, useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { Stepper } from "@/shared/components/common/Stepper";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createRequest } from "../api";
import { useViewer } from "../hooks";
import { detailsStepSchema, fieldErrors, residenceStepSchema, roomStepSchema } from "../schemas";
import { addDays, formatDay, todayISO } from "../utils/time";
import { DURATIONS, ROOM_TYPES, type HousingRequest, type Residence, type RoomType } from "../types";

interface Values {
  residenceId: string;
  roomType: RoomType;
  entryDate: string;
  durationMonths: number;
  accessibility: boolean;
  notes: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {!optional && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-red-700">
              *
            </span>
            <span className="sr-only"> ({t("housing.field.required")})</span>
          </>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

interface Props {
  residences: Residence[];
  initialResidenceId?: string;
  onDone: (request: HousingRequest) => void;
}

/** Demande de chambre en 4 étapes (résidence → chambre → précisions → confirmation). Résidence pleine ou doublon : 409 (ConflictAlert). */
export function HousingRequestStepper({ residences, initialResidenceId, onDone }: Props) {
  const t = useT();
  const viewer = useViewer();
  const panelRef = useRef<HTMLDivElement>(null);
  const { mutate, isPending } = useMutation(createRequest);

  const open = (id?: string) => residences.find((r) => r.id === id && r.occupied < r.capacity)?.id ?? "";
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({
    residenceId: open(initialResidenceId),
    roomType: "double",
    entryDate: addDays(30),
    durationMonths: 9,
    accessibility: false,
    notes: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<{ message: string; conflicts: string[] }>();
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setConflict(undefined);
  };

  const residence = residences.find((r) => r.id === values.residenceId);
  const steps = [
    { label: t("housing.step.residence") },
    { label: t("housing.step.room") },
    { label: t("housing.step.details") },
    { label: t("housing.step.confirm") },
  ];

  /** Valide l'étape courante ; renvoie vrai si on peut avancer. */
  function validate(): boolean {
    const schema = [residenceStepSchema, roomStepSchema, detailsStepSchema][step];
    if (!schema) return true;
    const raw = fieldErrors(schema, values);
    const next = Object.fromEntries(Object.entries(raw).map(([k, msg]) => [k, t(msg)])) as Errors;
    setErrors(next);
    if (Object.keys(next).length) setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
    return Object.keys(next).length === 0;
  }

  const go = (to: number) => {
    setStep(to);
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-step-title]")?.focus(), 0);
  };

  async function submit() {
    setConflict(undefined);
    setServiceError(undefined);
    try {
      const created = await mutate(values, viewer);
      toast.success(t("housing.sent", { residence: created.residenceName }));
      onDone(created);
    } catch (err) {
      if (isApiError(err) && err.isConflict) {
        setConflict({ message: err.message, conflicts: (err.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      } else if (isApiError(err) && err.status === 422) {
        setErrors({ entryDate: err.message });
        go(1);
      } else setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `hreq-${n}`;
  const invalid = (k: keyof Errors, hint?: string) => ({
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": [errors[k] ? `${id(k)}-error` : null, hint ? `${id(k)}-hint` : null].filter(Boolean).join(" ") || undefined,
    className: cn(errors[k] && "border-red-600"),
  });

  const summary: [string, string][] = [
    [t("housing.step.chosen"), residence?.name ?? "—"],
    [t("housing.field.roomType"), t(`housing.roomType.${values.roomType}`)],
    [t("housing.field.entryDate"), formatDay(values.entryDate)],
    [t("housing.field.duration"), t("housing.field.durationOption", { count: values.durationMonths })],
    [t("housing.field.accessibility"), values.accessibility ? t("housing.field.yes") : t("housing.field.no")],
    [t("housing.field.notes"), values.notes.trim() || t("housing.field.none")],
  ];

  return (
    <Card className="space-y-6 p-5 sm:p-6">
      <Stepper steps={steps} current={step} />

      <div ref={panelRef} className="space-y-4">
        <h2 data-step-title tabIndex={-1} className="text-lg font-semibold outline-none">
          {t("housing.step.of", { current: step + 1, total: steps.length })} — {steps[step]!.label}
        </h2>

        {serviceError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {serviceError}
          </p>
        )}
        {conflict && (
          <ConflictAlert
            title={t("housing.conflictTitle")}
            description={`${conflict.message}. ${t("housing.conflictHint")}`}
            conflicts={conflict.conflicts}
          />
        )}

        {step === 0 && (
          <fieldset aria-describedby={errors.residenceId ? id("residenceId-error") : undefined}>
            <legend className="mb-3 text-sm text-muted-foreground">{t("housing.step.residenceHelp")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {residences.map((r) => {
                const full = r.occupied >= r.capacity;
                const selected = values.residenceId === r.id;
                return (
                  <label
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      full ? "cursor-not-allowed bg-secondary opacity-70" : "cursor-pointer hover:bg-secondary",
                      selected && "border-navy bg-blue-50",
                    )}
                  >
                    {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-invalid signale l'erreur du groupe de choix aux lecteurs d'écran */}
                    <input
                      type="radio"
                      name="residence"
                      className="sr-only"
                      disabled={full}
                      checked={selected}
                      onChange={() => set("residenceId", r.id)}
                      aria-invalid={errors.residenceId ? true : undefined}
                    />
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{r.name}</span>
                      {full && (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          {t("housing.residence.full")}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("housing.residence.walk", { count: r.walkMinutes })} · {t("housing.residence.rent", { amount: r.monthlyRent })}
                    </span>
                    <CapacityGauge used={r.occupied} capacity={r.capacity} label={t("housing.residence.beds")} />
                  </label>
                );
              })}
            </div>
            {errors.residenceId && (
              <p id={id("residenceId-error")} className="mt-2 flex items-start gap-1.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {errors.residenceId}
              </p>
            )}
          </fieldset>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={id("roomType")} label={t("housing.field.roomType")} error={errors.roomType}>
              <Select
                id={id("roomType")}
                value={values.roomType}
                onChange={(e) => set("roomType", e.target.value as RoomType)}
                {...invalid("roomType")}
              >
                {ROOM_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {t(`housing.roomType.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={id("entryDate")} label={t("housing.field.entryDate")} error={errors.entryDate}>
              <Input
                id={id("entryDate")}
                type="date"
                min={todayISO()}
                value={values.entryDate}
                onChange={(e) => set("entryDate", e.target.value)}
                {...invalid("entryDate")}
              />
            </Field>
            <Field id={id("durationMonths")} label={t("housing.field.duration")} error={errors.durationMonths}>
              <Select
                id={id("durationMonths")}
                value={values.durationMonths}
                onChange={(e) => set("durationMonths", Number(e.target.value))}
                {...invalid("durationMonths")}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {t("housing.field.durationOption", { count: d })}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--primary))]"
                checked={values.accessibility}
                onChange={(e) => set("accessibility", e.target.checked)}
              />
              {t("housing.field.accessibility")}
            </label>
            <Field id={id("notes")} label={t("housing.field.notes")} error={errors.notes} hint={t("housing.field.notesHint")} optional>
              <textarea
                id={id("notes")}
                rows={4}
                maxLength={220}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
                {...invalid("notes", t("housing.field.notesHint"))}
                className={cn(
                  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground",
                  errors.notes && "border-red-600",
                )}
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <dl className="divide-y rounded-lg border">
            {summary.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[14rem_1fr]">
                <dt className="font-medium text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0 || isPending} onClick={() => go(step - 1)}>
          {t("housing.step.back")}
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={() => validate() && go(step + 1)}>
            {t("housing.step.next")}
          </Button>
        ) : (
          <Button type="button" disabled={isPending} onClick={() => void submit()}>
            {isPending ? t("housing.step.submitting") : t("housing.step.submit")}
          </Button>
        )}
      </div>
    </Card>
  );
}
