import { z } from "zod";
import { BOOK_CATEGORIES } from "../types";

/** Messages d'erreur = clés i18n (traduites par le formulaire). */
export const bookSchema = z.object({
  title: z.string().trim().min(2, "lib.err.titleShort").max(120, "lib.err.titleLong"),
  author: z.string().trim().min(2, "lib.err.authorShort").max(80, "lib.err.authorLong"),
  isbn: z
    .string()
    .trim()
    .regex(/^(97[89])-?\d{1,5}-?\d{1,7}-?\d{1,7}-?\d$|^\d{10}$|^97[89]-?\d{10}$/, "lib.err.isbn"),
  category: z.enum(BOOK_CATEGORIES, "lib.err.category"),
  year: z.number({ error: "lib.err.year" }).int("lib.err.year").min(1400, "lib.err.year").max(new Date().getFullYear(), "lib.err.year"),
  copies: z.number({ error: "lib.err.copies" }).int("lib.err.copies").min(1, "lib.err.copies").max(50, "lib.err.copies"),
  description: z.string().trim().max(300, "lib.err.descriptionLong"),
});

/** Renvoie les clés d'erreur par champ (objet vide = valide). */
export function fieldErrors(schema: z.ZodType, value: unknown): Record<string, string> {
  const r = schema.safeParse(value);
  const out: Record<string, string> = {};
  if (!r.success) for (const issue of r.error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}
