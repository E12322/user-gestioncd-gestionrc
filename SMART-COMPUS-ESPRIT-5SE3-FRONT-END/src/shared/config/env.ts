/**
 * Domaine d'e-mail institutionnel accepté par l'application.
 * Se règle dans `.env` avec VITE_EMAIL_DOMAIN (ex. gmail.com pour des tests) ; par défaut gmail.com.
 */
export const EMAIL_DOMAIN = (import.meta.env.VITE_EMAIL_DOMAIN ?? "").trim().replace(/^@/, "").toLowerCase() || "gmail.com";
