import { z } from "zod";

/** Note sur 20, au demi-point près ; vide = pas de note. Messages = clés i18n. */
export const gradeInputSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,2}([.,]\d{1,2})?$/.test(v), "academic.err.gradeFormat")
  .refine((v) => v === "" || Number(v.replace(",", ".")) <= 20, "academic.err.gradeRange");

/** Convertit la saisie ("12,5") en nombre ; "" → null. Renvoie `undefined` si invalide. */
export function parseGrade(input: string): number | null | undefined {
  const r = gradeInputSchema.safeParse(input);
  if (!r.success) return undefined;
  return r.data === "" ? null : Number(r.data.replace(",", "."));
}
