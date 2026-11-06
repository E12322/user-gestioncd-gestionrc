import { z } from "zod";
import { CLOSE_HOUR, OPEN_HOUR } from "../types";
import { TIME_OPTIONS, toMinutes, todayISO } from "../utils/time";

/** Messages d'erreur = clés i18n (traduites par le formulaire). */
export const reservationSchema = z
  .object({
    roomId: z.string().min(1, "resources.err.room"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "resources.err.date")
      .refine((d) => d >= todayISO(), "resources.err.datePast"),
    start: z.string().refine((v) => TIME_OPTIONS.includes(v) && toMinutes(v) < CLOSE_HOUR * 60, "resources.err.time"),
    end: z.string().refine((v) => TIME_OPTIONS.includes(v) && toMinutes(v) > OPEN_HOUR * 60, "resources.err.time"),
    attendees: z.number({ error: "resources.err.attendees" }).int("resources.err.attendees").min(1, "resources.err.attendees"),
    purpose: z.string().trim().min(3, "resources.err.purposeShort").max(120, "resources.err.purposeLong"),
  })
  .refine((v) => toMinutes(v.end) > toMinutes(v.start), { path: ["end"], message: "resources.err.endBeforeStart" });

export type ReservationFormValues = z.infer<typeof reservationSchema>;

/** Valide un formulaire brut ; renvoie les clés d'erreur par champ (vide = valide). */
export function validateReservation(raw: { roomId: string; date: string; start: string; end: string; attendees: string; purpose: string }) {
  const parsed = reservationSchema.safeParse({ ...raw, attendees: raw.attendees.trim() === "" ? NaN : Number(raw.attendees) });
  const errors: Partial<Record<keyof ReservationFormValues, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ReservationFormValues;
      errors[field] ??= issue.message;
    }
  }
  return { data: parsed.success ? parsed.data : undefined, errors };
}
