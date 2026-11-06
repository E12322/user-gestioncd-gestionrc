import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { leaveClub, requestMembership } from "../api";
import { useViewer } from "../hooks";
import type { Club } from "../types";

interface ConflictState {
  club: Club;
  message: string;
  conflicts: string[];
}

/**
 * Logique d'adhésion partagée (annuaire + fiche club) :
 * POST /clubs/{id}/members, retrait d'une demande, départ du club, et ConflictAlert sur 409 (club complet, doublon).
 */
export function useMembership(onDone: () => void) {
  const t = useT();
  const viewer = useViewer();
  const [pendingId, setPendingId] = useState<string>();
  const [conflict, setConflict] = useState<ConflictState>();
  const [leaving, setLeaving] = useState<Club>();

  async function run(club: Club, action: () => Promise<unknown>, successKey: string) {
    setConflict(undefined);
    setPendingId(club.id);
    try {
      await action();
      toast.success(t(successKey, { club: club.name }));
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setConflict({ club, message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      } else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setPendingId(undefined);
      setLeaving(undefined);
      onDone();
    }
  }

  const alert = conflict && (
    <ConflictAlert
      title={t("life.member.conflictTitle", { club: conflict.club.name })}
      description={conflict.message}
      conflicts={conflict.conflicts}
      action={
        <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
          {t("common.close")}
        </button>
      }
    />
  );

  const dialog = (
    <ConfirmDialog
      open={leaving !== undefined}
      onOpenChange={(o) => !o && pendingId === undefined && setLeaving(undefined)}
      loading={pendingId !== undefined}
      destructive
      title={leaving ? t("life.member.leaveTitle", { club: leaving.name }) : ""}
      description={t("life.member.leaveBody")}
      confirmLabel={t("life.member.leave")}
      onConfirm={() => (leaving ? run(leaving, () => leaveClub(leaving.id, viewer), "life.member.left") : undefined)}
    />
  );

  return {
    join: (club: Club) => run(club, () => requestMembership(club.id, viewer), "life.member.sent"),
    cancel: (club: Club) => run(club, () => leaveClub(club.id, viewer), "life.member.cancelled"),
    askLeave: setLeaving,
    pendingId,
    alert,
    dialog,
  };
}
