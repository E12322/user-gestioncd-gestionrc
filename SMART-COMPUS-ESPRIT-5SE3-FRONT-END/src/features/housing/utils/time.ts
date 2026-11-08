const pad = (n: number) => String(n).padStart(2, "0");

/** Date locale au format YYYY-MM-DD (pas d'UTC : évite le décalage d'un jour le soir). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
/** « 10 novembre 2026 » à partir d'un YYYY-MM-DD. */
export const formatDay = (isoDate: string) => dayFmt.format(new Date(`${isoDate}T12:00:00`));

/** Fin de l'année académique (31 juillet) : valeur proposée par défaut pour la date de départ. */
export const defaultDeparture = (from = new Date()) => {
  const year = from.getMonth() + 1 >= 8 ? from.getFullYear() + 1 : from.getFullYear();
  return `${year}-07-31`;
};

/** Affiche une date ISO (avec heure éventuelle) au format « JJ mois AAAA » sans décalage de fuseau. */
export const formatIsoDay = (iso: string) => formatDay(iso.slice(0, 10));
