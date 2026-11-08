import { z } from "zod";
import { CHAMBRE_TYPES, TICKET_CATEGORIES, capaciteValide, type ChambreType } from "../types";

/** Messages d'erreur = clés i18n (traduites par les formulaires). */

export const demandeSchema = z
  .object({
    dateArrivee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "housing.err.arrivee"),
    dateDepart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "housing.err.depart"),
    chambreId: z.string(),
  })
  .refine((v) => v.dateArrivee < v.dateDepart, { path: ["dateDepart"], message: "housing.err.dates" })
  .refine((v) => v.dateDepart <= academicYearEnd(v.dateArrivee), { path: ["dateDepart"], message: "housing.err.anneeAcademique" });

/** Fin de l'année académique (31 juillet) associée à une date d'arrivée. */
const academicYearEnd = (dateArrivee: string): string => {
  const [year, month] = dateArrivee.split("-").map(Number);
  return month >= 8 ? `${year + 1}-07-31` : `${year}-07-31`;
};

export const chambreSchema = z
  .object({
    numero: z.string().trim().min(2, "housing.err.numeroShort").max(20, "housing.err.numeroLong"),
    batiment: z.string().trim().min(2, "housing.err.batiment").max(60, "housing.err.batimentLong"),
    etage: z.number().int("housing.err.etage").min(0, "housing.err.etage").max(20, "housing.err.etage"),
    type: z.enum(CHAMBRE_TYPES as [string, ...string[]], "housing.err.type"),
    capacite: z.number().int("housing.err.capacite").min(1, "housing.err.capacite").max(4, "housing.err.capacite"),
  })
  .refine((v) => capaciteValide(v.type as ChambreType, v.capacite), { path: ["capacite"], message: "housing.err.capaciteType" });

export const ticketSchema = z.object({
  batiment: z.string().min(1, "housing.err.batimentChoice"),
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
