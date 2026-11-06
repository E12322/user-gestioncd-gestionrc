import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import { EventCard } from "../components/EventCard";
import { MembershipButton } from "../components/MembershipButton";
import { useMembership } from "../components/useMembership";
import { useClub } from "../hooks";

const SHOWN_MEMBERS = 12;

/** Fiche d'un club : description, adhésion, membres et prochains événements. */
export default function ClubDetailPage() {
  const t = useT();
  const { id = "" } = useParams();
  const query = useClub(id);
  const { join, cancel, askLeave, pendingId, alert, dialog } = useMembership(query.refetch);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/vie-etudiante">
          <ArrowLeft aria-hidden="true" />
          {t("life.back")}
        </Link>
      </Button>

      {alert}

      <QueryBoundary
        query={query}
        moduleName={t("module.student-life")}
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        }
      >
        {(club) => (
          <div className="space-y-6">
            <Card className="space-y-4 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">{club.category}</p>
                <h2 className="text-2xl font-bold tracking-tight">{club.name}</h2>
              </div>
              <p className="text-sm">{club.description}</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Users className="size-4" aria-hidden="true" />
                  {t("life.club.members", { count: club.members })}
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden="true" />
                  {t("life.club.place")} : {club.meetingPlace}
                </li>
              </ul>
              <CapacityGauge used={club.members} capacity={club.maxMembers} label={t("life.club.capacity")} className="max-w-sm" />
              <MembershipButton
                club={club}
                busy={pendingId === club.id}
                onJoin={(x) => void join(x)}
                onCancel={(x) => void cancel(x)}
                onLeave={askLeave}
              />
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <section aria-labelledby="club-events">
                <h3 id="club-events" className="mb-3 text-lg font-semibold">
                  {t("life.club.events")}
                </h3>
                {club.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("life.club.noEvents")}</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {club.events.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="club-members">
                <h3 id="club-members" className="mb-3 text-lg font-semibold">
                  {t("life.club.membersList")}
                </h3>
                {club.memberNames.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("life.club.membersNone")}</p>
                ) : (
                  <Card className="p-4">
                    <ul className="space-y-1.5 text-sm">
                      {club.memberNames.slice(0, SHOWN_MEMBERS).map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                    {club.members > Math.min(club.memberNames.length, SHOWN_MEMBERS) && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("life.club.membersMore", { count: club.members - Math.min(club.memberNames.length, SHOWN_MEMBERS) })}
                      </p>
                    )}
                  </Card>
                )}
              </section>
            </div>
          </div>
        )}
      </QueryBoundary>
      {dialog}
    </div>
  );
}
