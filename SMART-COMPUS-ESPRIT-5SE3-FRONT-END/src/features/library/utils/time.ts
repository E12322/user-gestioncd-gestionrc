const pad = (n: number) => String(n).padStart(2, "0");

/** Date locale au format YYYY-MM-DD (pas d'UTC : évite le décalage d'un jour le soir). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const at = (isoDate: string) => new Date(`${isoDate}T12:00:00`);
/** Nombre de jours entiers de `a` à `b` (positif si `b` est après `a`). */
export const diffDays = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);
/** Date ISO d'un jour donné décalée de n jours. */
export const shiftDate = (isoDate: string, days: number) => addDays(days, at(isoDate));

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
/** « 10 novembre 2026 » à partir d'un YYYY-MM-DD. */
export const formatDay = (isoDate: string) => fmt.format(at(isoDate));
