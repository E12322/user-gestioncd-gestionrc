import { z } from "zod";
import { DURATIONS, ROOM_TYPES, TICKET_CATEGORIES } from "../types";
import { todayISO } from "../utils/time";

/** Messages d'erreur = clés i18n (traduites par les formulaires). */

// Étape 1 — résidence
export const residenceStepSchema = z.object({ residenceId: z.string().min(1, "housing.err.residence") });

// Étape 2 — chambre et dates
export const roomStepSchema = z.object({
  roomType: z.enum(ROOM_TYPES as [string, ...string[]], "housing.err.roomType"),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "housing.err.date")
    .refine((d) => d >= todayISO(), "housing.err.datePast"),
  durationMonths: z.number().refine((n) => (DURATIONS as readonly number[]).includes(n), "housing.err.duration"),
});

// Étape 3 — précisions
export const detailsStepSchema = z.object({
  accessibility: z.boolean(),
  notes: z.string().trim().max(200, "housing.err.notesLong"),
});

export const ticketSchema = z.object({
  residenceId: z.string().min(1, "housing.err.residence"),
  location: z.string().trim().min(2, "housing.err.locationShort").max(60, "housing.err.locationLong"),
  category: z.enum(TICKET_CATEGORIES as [string, ...string[]], "housing.err.category"),
  description: z.string().trim().min(10, "housing.err.descriptionShort").max(300, "housing.err.descriptionLong"),
});

/** Renvoie les clés d'erreur par champ (objet vide = valide). */
export function fieldErrors(schema: z.ZodType, value: unknown): Record<string, string> {
  const r = schema.safeParse(value);
  const out: Record<string, string> = {};
  if (!r.success) for (const issue of r.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}
