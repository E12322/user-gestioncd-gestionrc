import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { isApiError } from "@/shared/api/errors";
import { useMutation } from "@/shared/api/useMutation";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { createReservation } from "../api";
import { useRooms, useViewer } from "../hooks";
import { validateReservation, type ReservationFormValues } from "../schemas";
import { addDays, formatDay, TIME_OPTIONS, todayISO } from "../utils/time";
import type { RoomView } from "../types";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { EquipmentList } from "./EquipmentList";

type Errors = Partial<Record<keyof ReservationFormValues, string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        <span aria-hidden="true" className="ml-0.5 text-red-700">
          *
        </span>
        <span className="sr-only"> ({t("resources.form.required")})</span>
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

const focusFirstInvalid = (form: HTMLFormElement | null) =>
  setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

/** Formulaire de demande de réservation : validation zod, jauge de capacité, disponibilités du jour et ConflictAlert sur 409. */
export function ReservationForm({ initialRoomId }: { initialRoomId?: string }) {
  const t = useT();
  const navigate = useNavigate();
  const { role } = useAuth();
  const viewer = useViewer();
  const formRef = useRef<HTMLFormElement>(null);
  const rooms = useRooms();
  const { mutate, isPending } = useMutation(createReservation);

  const [values, setValues] = useState({
    roomId: initialRoomId ?? "",
    date: addDays(1),
    start: "09:00",
    end: "11:00",
    attendees: "",
    purpose: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [conflict, setConflict] = useState<{ room: string; message: string; conflicts: string[] }>();
  const [serviceError, setServiceError] = useState<string>();

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    // Changer salle ou créneau rend l'ancien conflit obsolète.
    if (k === "roomId" || k === "date" || k === "start" || k === "end") setConflict(undefined);
  };

  async function submit(e: FormEvent, list: RoomView[]) {
    e.preventDefault();
    setConflict(undefined);
    setServiceError(undefined);
    const room = list.find((r) => r.id === values.roomId);
    const { data, errors: keys } = validateReservation(values);
    const next: Errors = Object.fromEntries(Object.entries(keys).map(([k, msg]) => [k, t(msg)]));
    if (data && room && data.attendees > room.capacity) next.attendees = t("resources.err.capacity", { max: room.capacity });
    if (!data || Object.keys(next).length) {
      setErrors(next);
      return focusFirstInvalid(formRef.current);
    }
    try {
      const created = await mutate(data, viewer);
      toast.success(
        t(`resources.form.sent.${created.status === "confirmed" ? "confirmed" : "pending"}`, {
          room: created.roomName,
          date: formatDay(created.date),
        }),
      );
      navigate("/ressources/mes-reservations");
    } catch (err) {
      if (isApiError(err) && err.isConflict) {
        setConflict({
          room: room?.name ?? "",
          message: err.message,
          conflicts: (err.details as { conflicts?: string[] } | undefined)?.conflicts ?? [],
        });
      } else if (isApiError(err) && err.status === 422) {
        setErrors({ attendees: err.message });
        focusFirstInvalid(formRef.current);
      } else setServiceError(isApiError(err) ? (err.isUnavailable ? t("error.unavailable.title") : err.message) : t("error.generic"));
    }
  }

  const id = (n: string) => `rsv-${n}`;
  const invalid = (k: keyof Errors, hint?: string) => ({
    "aria-invalid": errors[k] ? (true as const) : undefined,
    "aria-describedby": [errors[k] ? `${id(k)}-error` : null, hint ? `${id(k)}-hint` : null].filter(Boolean).join(" ") || undefined,
    className: cn(errors[k] && "border-red-600"),
  });

  return (
    <QueryBoundary query={rooms} moduleName={t("module.resources")}>
      {(list) => {
        const room = list.find((r) => r.id === values.roomId);
        const attendees = Number(values.attendees);
        const showGauge = room && Number.isFinite(attendees) && attendees > 0;
        return (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card className="p-5 sm:p-6">
              <form
                ref={formRef}
                onSubmit={(e) => void submit(e, list)}
                noValidate
                className="space-y-4"
                aria-label={t("resources.form.title")}
              >
                <p className="text-sm text-muted-foreground">
                  {role === "admin" ? t("resources.form.adminNote") : t("resources.form.teacherNote")}
                </p>

                {serviceError && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                    {serviceError}
                  </p>
                )}
                {conflict && (
                  <ConflictAlert
                    title={t("resources.form.conflictTitle", { room: conflict.room })}
                    description={`${conflict.message}. ${t("resources.form.conflictHint")}`}
                    conflicts={conflict.conflicts}
                  />
                )}

                <Field id={id("roomId")} label={t("resources.form.room")} error={errors.roomId}>
                  <Select id={id("roomId")} value={values.roomId} onChange={(e) => set("roomId", e.target.value)} {...invalid("roomId")}>
                    <option value="">{t("resources.form.roomPlaceholder")}</option>
                    {list.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.building} ({t("resources.room.capacity", { count: r.capacity })})
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id={id("date")} label={t("resources.form.date")} error={errors.date}>
                    <Input
                      id={id("date")}
                      type="date"
                      min={todayISO()}
                      value={values.date}
                      onChange={(e) => set("date", e.target.value)}
                      {...invalid("date")}
                    />
                  </Field>
                  <Field id={id("start")} label={t("resources.form.start")} error={errors.start}>
                    <Select id={id("start")} value={values.start} onChange={(e) => set("start", e.target.value)} {...invalid("start")}>
                      {TIME_OPTIONS.slice(0, -1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id={id("end")} label={t("resources.form.end")} error={errors.end}>
                    <Select id={id("end")} value={values.end} onChange={(e) => set("end", e.target.value)} {...invalid("end")}>
                      {TIME_OPTIONS.slice(1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field id={id("attendees")} label={t("resources.form.attendees")} error={errors.attendees}>
                  <Input
                    id={id("attendees")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={values.attendees}
                    onChange={(e) => set("attendees", e.target.value)}
                    {...invalid("attendees")}
                  />
                </Field>
                {showGauge && (
                  <div>
                    <CapacityGauge used={attendees} capacity={room.capacity} label={t("resources.form.capacity")} />
                    {attendees > room.capacity && <p className="mt-1 text-sm text-red-700">{t("resources.form.over")}</p>}
                  </div>
                )}

                <Field id={id("purpose")} label={t("resources.form.purpose")} error={errors.purpose} hint={t("resources.form.purposeHint")}>
                  <Input
                    id={id("purpose")}
                    maxLength={140}
                    value={values.purpose}
                    onChange={(e) => set("purpose", e.target.value)}
                    {...invalid("purpose", t("resources.form.purposeHint"))}
                  />
                </Field>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending
                      ? t("resources.form.submitting")
                      : role === "admin"
                        ? t("resources.form.submitAdmin")
                        : t("resources.form.submit")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/ressources")}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            </Card>

            <aside aria-label={t("resources.avail.title", { room: room?.name ?? t("resources.form.room") })}>
              <Card className="space-y-4 p-5">
                {room ? (
                  <>
                    <div>
                      <h2 className="text-base font-semibold">{room.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {room.building} · {t("resources.room.capacity", { count: room.capacity })}
                      </p>
                    </div>
                    <EquipmentList equipment={room.equipment} />
                    {/^\d{4}-\d{2}-\d{2}$/.test(values.date) && <AvailabilityCalendar roomId={room.id} date={values.date} />}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("resources.form.roomPlaceholder")}</p>
                )}
              </Card>
            </aside>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
