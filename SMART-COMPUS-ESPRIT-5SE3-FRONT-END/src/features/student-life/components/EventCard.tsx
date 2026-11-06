import { Link } from "react-router-dom";
import { useT } from "@/shared/i18n";
import type { CampusEvent } from "../types";

/** Événement de l'agenda : l'horaire en premier, puis l'intitulé, le lieu et le club organisateur. */
export function EventCard({ event }: { event: CampusEvent }) {
  const t = useT();
  return (
    <li className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-6 py-4">
      <p className="tabular text-sm font-semibold">
        {event.start}–{event.end}
      </p>
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug">{event.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {event.clubId ? (
            <Link to={`/vie-etudiante/clubs/${event.clubId}`} className="rounded underline-offset-4 hover:underline">
              {event.clubName}
            </Link>
          ) : (
            t("life.events.campus")
          )}
          {" · "}
          {event.location}
        </p>
        {event.description && <p className="mt-2 max-w-[62ch] text-sm">{event.description}</p>}
      </div>
    </li>
  );
}
