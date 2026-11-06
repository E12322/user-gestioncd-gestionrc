import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";

/** Score 0–4 : longueur, casse mixte, chiffre, symbole / longueur ≥ 12. */
export function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.max(1, s) as 1 | 2 | 3 | 4;
}

// Barres ≥ 3:1 sur blanc ; le niveau est aussi écrit en toutes lettres (jamais la couleur seule).
const BAR = ["bg-slate-300", "bg-red-600", "bg-amber-600", "bg-blue-600", "bg-green-600"];
const TEXT = ["text-muted-foreground", "text-red-800", "text-amber-900", "text-blue-800", "text-green-800"];

/** Jauge de robustesse. Hauteur toujours réservée : aucun saut de mise en page à la saisie. */
export function PasswordStrength({ password }: { password: string }) {
  const t = useT();
  const score = scorePassword(password);
  const label = score === 0 ? t("users.strength.empty") : t(`users.strength.${score}`);
  return (
    <div className="mt-1 flex items-center gap-3">
      <div
        role="meter"
        aria-label={t("users.strength.label")}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label}
        className="flex flex-1 gap-1"
      >
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("h-1.5 flex-1 rounded-full transition-colors duration-150", i <= score ? BAR[score] : "bg-slate-200")}
          />
        ))}
      </div>
      <span className={cn("w-24 text-right text-xs font-medium transition-colors duration-150", TEXT[score])}>{label}</span>
    </div>
  );
}
