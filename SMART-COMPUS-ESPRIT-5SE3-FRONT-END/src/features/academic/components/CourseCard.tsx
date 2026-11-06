import { Link } from "react-router-dom";
import { Clock, GraduationCap, User, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { useT } from "@/shared/i18n";
import type { CourseView } from "../types";

interface CourseCardProps {
  course: CourseView;
  /** Affiche le bouton d'inscription (étudiant). */
  canEnroll?: boolean;
  enrolling?: boolean;
  onEnroll?: (course: CourseView) => void;
  mine?: boolean;
  onEdit?: (course: CourseView) => void;
  onDelete?: (course: CourseView) => void;
}

/** Fiche de cours : code, intitulé, enseignant, crédits, remplissage et état d'inscription. */
export function CourseCard({ course, canEnroll, enrolling, onEnroll, mine, onEdit, onDelete }: CourseCardProps) {
  const t = useT();
  const full = course.enrolled >= course.capacity;
  const state = course.myEnrollment;
  const hours = course.sessions.length;
  const docCount =
    course.documents && course.documents.length > 0
      ? course.documents.length
      : [course.documentResource, course.videoResource, course.externalResource].filter(Boolean).length;

  return (
    <Card className="flex flex-col gap-4 p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              {course.code} · {course.department}
            </p>
            <span
              className={`rounded px-1.5 py-0.5 text-3xs font-bold border ${
                course.nature === "OPTIONNEL"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              }`}
            >
              {course.nature === "OPTIONNEL" ? "Optionnel" : "Obligatoire"}
            </span>
            {docCount > 0 && (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-3xs font-bold text-rose-700 border border-rose-200">
                {docCount} support{docCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">
            <Link to={`/academique/cours/${course.id}`} className="rounded hover:underline">
              {course.title}
            </Link>
          </h3>
        </div>
        {state && <StatusPill status={state} />}
      </div>

      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <User className="size-4 shrink-0" aria-hidden="true" />
          {course.teacherName}
          {mine && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">{t("academic.course.mine")}</span>
          )}
        </li>
        <li className="flex items-center gap-2">
          <GraduationCap className="size-4 shrink-0" aria-hidden="true" />
          {t("academic.course.credits", { credits: course.credits })} · {course.semester}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {t("academic.course.sessions", { count: hours })}
        </li>
      </ul>

      <CapacityGauge used={course.enrolled} capacity={course.capacity} label={t("academic.course.seats")} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/academique/cours/${course.id}`}>{t("academic.course.details")}</Link>
          </Button>
          {course.nature === "OPTIONNEL" ? (
            canEnroll && (!state || state === "refused") && (
              <Button
                size="sm"
                disabled={enrolling}
                onClick={() => onEnroll?.(course)}
                aria-label={`${t("academic.enroll")} — ${course.code}`}
              >
                {full ? t("academic.enroll.full") : state === "refused" ? t("academic.enroll.retry") : t("academic.enroll")}
              </Button>
            )
          ) : state === "validated" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800 self-center">
              Inscrit via {course.groupName || "5SE3"}
            </span>
          ) : canEnroll && (!state || state === "refused") ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium italic self-center">
              Affectation par groupe
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(course)}
              className="size-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
              title="Modifier ce cours"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(course)}
              className="size-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title="Supprimer ce cours"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
