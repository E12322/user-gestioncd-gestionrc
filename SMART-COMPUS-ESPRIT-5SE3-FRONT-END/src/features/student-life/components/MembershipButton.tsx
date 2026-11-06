import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import type { ClubView } from "../types";

interface MembershipButtonProps {
  club: ClubView;
  busy?: boolean;
  onJoin: (club: ClubView) => void;
  onCancel: (club: ClubView) => void;
  onLeave: (club: ClubView) => void;
}

/** Bouton d'adhésion selon l'état : Adhérer / Demande envoyée (annulable) / Membre (peut quitter) / Refaire une demande. */
export function MembershipButton({ club, busy, onJoin, onCancel, onLeave }: MembershipButtonProps) {
  const t = useT();
  const { role } = useAuth();
  if (role === "admin") return <p className="text-xs text-muted-foreground">{t("life.member.adminNote")}</p>;

  const state = club.myMembership?.status;
  const full = club.members >= club.maxMembers;
  const label = (key: string) => `${t(key)} — ${club.name}`;

  if (state === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{t("life.member.pending")}</span>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(club)} aria-label={label("life.member.cancel")}>
          {t("life.member.cancel")}
        </Button>
      </div>
    );
  }
  if (state === "confirmed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-green-800">{t("life.member.isMember")}</span>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onLeave(club)} aria-label={label("life.member.leave")}>
          {t("life.member.leave")}
        </Button>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={() => onJoin(club)}
      aria-label={label(state === "refused" ? "life.member.retry" : "life.member.join")}
    >
      {full ? t("life.member.joinFull") : state === "refused" ? t("life.member.retry") : t("life.member.join")}
    </Button>
  );
}
