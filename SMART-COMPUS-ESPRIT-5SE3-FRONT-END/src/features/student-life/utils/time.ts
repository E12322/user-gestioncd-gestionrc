const pad = (n: number) => String(n).padStart(2, "0");

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Date locale au format YYYY-MM-DD (pas d'UTC : évite le décalage d'un jour le soir). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Heures proposées pour un événement : toutes les 30 min, de 07:00 à 22:00. */
export const TIME_OPTIONS: string[] = Array.from({ length: 31 }, (_, i) => `${pad(7 + Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
/** « jeudi 15 octobre » à partir d'un YYYY-MM-DD. */
export const formatDay = (isoDate: string) => longDay.format(new Date(`${isoDate}T12:00:00`));
