import { z, type ZodType } from "zod";
import { isInstitutionalEmail } from "../utils/validation";

/**
 * Schémas de validation des formulaires d'authentification.
 * Les messages sont des clés i18n (résolues à l'affichage avec `t`).
 */
export const emailSchema = z.string().trim().min(1, "users.err.required").refine(isInstitutionalEmail, "users.err.emailDomain");

export const passwordRules = z
  .string()
  .min(8, "users.err.passwordShort")
  .refine((p) => /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p), "users.err.passwordWeak");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "users.err.required"),
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "users.err.required"),
    lastName: z.string().trim().min(1, "users.err.required"),
    email: emailSchema,
    password: passwordRules,
    confirm: z.string().min(1, "users.err.required"),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "users.err.passwordMismatch" });

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({ password: passwordRules, confirm: z.string().min(1, "users.err.required") })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "users.err.passwordMismatch" });

export const otpSchema = z.string().regex(/^\d{6}$/, "users.verify.badCode");

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Valide `values` ; renvoie les données typées, ou la première clé d'erreur i18n par champ. */
export function validate<T>(
  schema: ZodType<T>,
  values: unknown,
): { data: T; errors?: undefined } | { data?: undefined; errors: FieldErrors<T> } {
  const r = schema.safeParse(values);
  if (r.success) return { data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { errors: errors as FieldErrors<T> };
}
