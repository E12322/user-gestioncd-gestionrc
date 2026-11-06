import { useState } from "react";
import { toast } from "sonner";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { isApiError } from "@/shared/api/errors";
import { useT } from "@/shared/i18n";
import { enroll } from "../api";
import { useViewer } from "../hooks";
import type { CourseView } from "../types";

interface ConflictState {
  course: CourseView;
  message: string;
  conflicts: string[];
}

/**
 * Logique d'inscription partagée (catalogue + fiche cours) :
 * POST /enrollments, toast de succès, et ConflictAlert sur 409 (horaire, cours complet, doublon).
 */
export function useEnroll(onDone: () => void) {
  const t = useT();
  const viewer = useViewer();
  const [pendingId, setPendingId] = useState<string>();
  const [conflict, setConflict] = useState<ConflictState>();

  async function run(course: CourseView) {
    setConflict(undefined);
    setPendingId(course.id);
    try {
      await enroll(course.id, viewer);
      toast.success(t("academic.enroll.sent", { code: course.code }));
      onDone();
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setConflict({ course, message: e.message, conflicts: (e.details as { conflicts?: string[] } | undefined)?.conflicts ?? [] });
      } else toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setPendingId(undefined);
    }
  }

  const alert = conflict && (
    <ConflictAlert
      title={t("academic.enroll.conflictTitle", { code: conflict.course.code })}
      description={conflict.message}
      conflicts={conflict.conflicts}
      action={
        <button type="button" onClick={() => setConflict(undefined)} className="rounded text-sm font-medium underline">
          {t("common.close")}
        </button>
      }
    />
  );

  return { enroll: run, pendingId, alert };
}
