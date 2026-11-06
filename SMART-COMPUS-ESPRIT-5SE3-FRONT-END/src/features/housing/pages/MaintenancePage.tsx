import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { formatDateTime } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { createTicket, updateTicketStatus } from "../api";
import { TicketStatusBadge } from "../components/TicketStatusBadge";
import { useResidences, useTickets, useViewer } from "../hooks";
import { fieldErrors, ticketSchema } from "../schemas";
import { TICKET_CATEGORIES, type Residence, type Ticket, type TicketCategory, type TicketStatus } from "../types";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved"];

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        <span aria-hidden="true" className="ml-0.5 text-red-700">
          *
        </span>
        <span className="sr-only"> ({t("housing.field.required")})</span>
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

type Errors = Partial<Record<"residenceId" | "location" | "category" | "description", string>>;

function TicketForm({ residences, onCreated }: { residences: Residence[]; onCreated: () => void }) {
  const t = useT();
  const viewer = useViewer();
  const formRef = useRef<HTMLFormElement>(null);
  const { mutate, isPending } = useMutation(createTicket);
  const [values, setValues] = useState({
    residenceId: residences[0]?.id ?? "",
    location: "",
    category: "" as TicketCategory | "",
    description: "",
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
    const raw = fieldErrors(ticketSchema, values);
    if (Object.keys(raw).length) {
      setErrors(Object.fromEntries(Object.entries(raw).map(([k, m]) => [k, t(m)])));
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    try {
      const created = await mutate({ ...values, category: values.category as TicketCategory }, viewer);
      toast.success(t("housing.maintenance.sent", { location: created.location }));
      setValues((s) => ({ ...s, location: "", category: "", description: "" }));
      onCreated();
    } catch (err) {
      setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `tkt-${n}`;
  const a11y = (k: keyof Errors, hint?: string) => ({
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": [errors[k] ? `${id(k)}-error` : null, hint ? `${id(k)}-hint` : null].filter(Boolean).join(" ") || undefined,
  });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{t("housing.maintenance.report")}</h2>
      <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        {serviceError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {serviceError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={id("residenceId")} label={t("housing.field.residence")} error={errors.residenceId}>
            <Select
              id={id("residenceId")}
              value={values.residenceId}
              onChange={(e) => set("residenceId", e.target.value)}
              className={cn(errors.residenceId && "border-red-600")}
              {...a11y("residenceId")}
            >
              <option value="">{t("housing.field.residencePlaceholder")}</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("location")} label={t("housing.field.location")} error={errors.location} hint={t("housing.field.locationHint")}>
            <Input
              id={id("location")}
              maxLength={70}
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              className={cn(errors.location && "border-red-600")}
              {...a11y("location", t("housing.field.locationHint"))}
            />
          </Field>
          <Field id={id("category")} label={t("housing.field.category")} error={errors.category}>
            <Select
              id={id("category")}
              value={values.category}
              onChange={(e) => set("category", e.target.value as TicketCategory)}
              className={cn(errors.category && "border-red-600")}
              {...a11y("category")}
            >
              <option value="">{t("housing.field.categoryPlaceholder")}</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`housing.ticket.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          id={id("description")}
          label={t("housing.field.description")}
          error={errors.description}
          hint={t("housing.field.descriptionHint")}
        >
          <textarea
            id={id("description")}
            rows={3}
            maxLength={320}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            className={cn("flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm", errors.description && "border-red-600")}
            {...a11y("description", t("housing.field.descriptionHint"))}
          />
        </Field>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("housing.step.submitting") : t("housing.field.submitTicket")}
        </Button>
      </form>
    </Card>
  );
}

function TicketRow({ ticket, admin, onChanged }: { ticket: Ticket; admin: boolean; onChanged: () => void }) {
  const t = useT();
  const viewer = useViewer();
  const [pending, setPending] = useState(false);

  async function change(status: TicketStatus) {
    setPending(true);
    try {
      await updateTicketStatus(ticket.id, status, viewer);
      toast.success(t("housing.maintenance.updated", { status: t(`housing.ticketStatus.${status}`) }));
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setPending(false);
      onChanged();
    }
  }

  return (
    <Card className="space-y-2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t(`housing.ticket.${ticket.category}`)}</p>
          <h3 className="text-base font-semibold">
            {t("housing.maintenance.at", { residence: ticket.residenceName, location: ticket.location })}
          </h3>
        </div>
        {admin ? (
          <div className="w-40">
            <label htmlFor={`st-${ticket.id}`} className="sr-only">
              {t("housing.maintenance.statusLabel", { location: ticket.location })}
            </label>
            <Select
              id={`st-${ticket.id}`}
              value={ticket.status}
              disabled={pending}
              onChange={(e) => void change(e.target.value as TicketStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`housing.ticketStatus.${s}`)}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <TicketStatusBadge status={ticket.status} />
        )}
      </div>
      <p className="text-sm">{ticket.description}</p>
      <p className="text-xs text-muted-foreground">
        {t("housing.maintenance.by", { name: ticket.studentName, date: formatDateTime(ticket.createdAt) })}
      </p>
    </Card>
  );
}

/** Étudiant : signaler une panne et suivre ses signalements. Administrateur : traiter tous les signalements (Signalé → En cours → Résolu). */
export default function MaintenancePage() {
  const t = useT();
  const { role } = useAuth();
  const admin = role === "admin";
  const tickets = useTickets();
  const residences = useResidences();

  return (
    <div className="space-y-6">
      {!admin && (
        <QueryBoundary query={residences} moduleName={t("module.housing")} skeleton={<Skeleton className="h-64 w-full rounded-xl" />}>
          {(list) => <TicketForm residences={list} onCreated={tickets.refetch} />}
        </QueryBoundary>
      )}

      <QueryBoundary
        query={tickets}
        moduleName={t("module.housing")}
        skeleton={
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        }
      >
        {(list) =>
          list.length === 0 ? (
            <Card>
              <EmptyState icon={Wrench} title={admin ? t("housing.maintenance.emptyAdmin") : t("housing.maintenance.empty")} />
            </Card>
          ) : (
            <div className="space-y-3">
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {t("housing.maintenance.count", { count: list.length })}
              </p>
              <ul className="space-y-3">
                {list.map((x) => (
                  <li key={x.id}>
                    <TicketRow ticket={x} admin={admin} onChanged={tickets.refetch} />
                  </li>
                ))}
              </ul>
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}
