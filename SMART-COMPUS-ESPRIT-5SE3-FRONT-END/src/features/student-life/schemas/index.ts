import { z } from "zod";
import { TIME_OPTIONS, todayISO, toMinutes } from "../utils/time";
import { CATEGORIES } from "../types";

/** Messages d'erreur = clés i18n (traduites par les formulaires). */
export const clubSchema = z.object({
  name: z.string().trim().min(3, "life.err.nameShort").max(60, "life.err.nameLong"),
  category: z.enum(CATEGORIES, "life.err.category"),
  description: z.string().trim().min(10, "life.err.descriptionShort").max(300, "life.err.descriptionLong"),
  meetingPlace: z.string().trim().min(2, "life.err.placeShort").max(60, "life.err.placeLong"),
  maxMembers: z
    .number({ error: "life.err.maxMembers" })
    .int("life.err.maxMembers")
    .min(5, "life.err.maxMembers")
    .max(500, "life.err.maxMembers"),
});

export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "life.err.titleShort").max(80, "life.err.titleLong"),
    description: z.string().trim().max(200, "life.err.eventDescriptionLong"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "life.err.date")
      .refine((d) => d >= todayISO(), "life.err.datePast"),
    start: z.string().refine((v) => TIME_OPTIONS.includes(v), "life.err.time"),
    end: z.string().refine((v) => TIME_OPTIONS.includes(v), "life.err.time"),
    location: z.string().trim().min(2, "life.err.placeShort").max(60, "life.err.placeLong"),
    clubId: z.string().optional(),
  })
  .refine((v) => toMinutes(v.end) > toMinutes(v.start), { path: ["end"], message: "life.err.endBeforeStart" });

/** Renvoie les clés d'erreur par champ (objet vide = valide). */
export function fieldErrors(schema: z.ZodType, value: unknown): Record<string, string> {
  const r = schema.safeParse(value);
  const out: Record<string, string> = {};
  if (!r.success) for (const issue of r.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}
