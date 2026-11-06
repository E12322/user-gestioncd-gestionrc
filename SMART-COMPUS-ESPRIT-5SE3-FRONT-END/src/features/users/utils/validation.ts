import { EMAIL_DOMAIN } from "@/shared/config/env";

export const INSTITUTIONAL_DOMAIN = EMAIL_DOMAIN;
export const MAX_ATTEMPTS = 5;

export const isInstitutionalEmail = (email: string) =>
  new RegExp(`^[^\\s@]+@${INSTITUTIONAL_DOMAIN.replace(/\./g, "\\.")}$`, "i").test(email.trim());

/** Retourne la clé i18n de l'erreur, ou null si le mot de passe est valide. */
export function passwordError(pw: string): string | null {
  if (pw.length < 8) return "users.err.passwordShort";
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return "users.err.passwordWeak";
  return null;
}

/** Mot de passe temporaire : 10 caractères sans lettres ambiguës, avec majuscule, minuscule et chiffre. */
export function generateTemporaryPassword(): string {
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0]! % chars.length]!;
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const chars = [pick(upper), pick(lower), pick(digits), ...Array.from({ length: 7 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Place le focus sur le premier champ invalide d'un formulaire (accessibilité). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
}
