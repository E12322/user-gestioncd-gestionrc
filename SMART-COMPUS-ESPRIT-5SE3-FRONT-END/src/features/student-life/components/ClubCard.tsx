import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { CatalogRow } from "@/shared/components/common/CatalogRow";
import { useT } from "@/shared/i18n";
import type { ClubView } from "../types";
import { MembershipButton } from "./MembershipButton";

interface ClubCardProps {
  club: ClubView;
  busy?: boolean;
  onJoin: (club: ClubView) => void;
  onCancel: (club: ClubView) => void;
  onLeave: (club: ClubView) => void;
}

/** Ligne du catalogue des clubs : catégorie, description, lieu, remplissage et bouton d'adhésion. */
export function ClubCard({ club, busy, onJoin, onCancel, onLeave }: ClubCardProps) {
  const t = useT();
  return (
    <CatalogRow
      title={
        <Link to={`/vie-etudiante/clubs/${club.id}`} className="rounded hover:underline">
          {club.name}
        </Link>
      }
      meta={[club.category, t("life.club.members", { count: club.members }), club.meetingPlace]}
      description={club.description}
      gauge={<CapacityGauge used={club.members} capacity={club.maxMembers} label={t("life.club.capacity")} />}
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/vie-etudiante/clubs/${club.id}`} aria-label={`${t("life.club.details")} — ${club.name}`}>
              {t("life.club.details")}
            </Link>
          </Button>
          <MembershipButton club={club} busy={busy} onJoin={onJoin} onCancel={onCancel} onLeave={onLeave} />
        </>
      }
    />
  );
}
