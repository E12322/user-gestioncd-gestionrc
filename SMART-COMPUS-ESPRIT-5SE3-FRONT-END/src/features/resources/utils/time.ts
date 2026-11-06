import { CLOSE_HOUR, OPEN_HOUR } from "../types";

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, "0");
export const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Date locale au format YYYY-MM-DD (pas d'UTC : évite le décalage d'un jour le soir). */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

/** Créneaux de début possibles : toutes les 30 min dans les heures d'ouverture. */
export const TIME_OPTIONS: string[] = Array.from({ length: (CLOSE_HOUR - OPEN_HOUR) * 2 + 1 }, (_, i) =>
  fromMinutes(OPEN_HOUR * 60 + i * 30),
);

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
/** « jeudi 15 octobre » à partir d'un YYYY-MM-DD. */
export const formatDay = (isoDate: string) => dayFmt.format(new Date(`${isoDate}T12:00:00`));
