import { useEffect, useMemo, useRef, useState } from "react";
import { Award, GraduationCap, Percent } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { isApiError } from "@/shared/api/errors";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { saveGrades } from "../api";
import { useCourseGrades, useCourses, useMyGrades, useViewer } from "../hooks";
import { parseGrade, gradeInputSchema } from "../schemas";
import { PASS_MARK, type CourseGrades, type MyGrade } from "../types";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Étudiant : notes publiées + moyenne pondérée par les crédits. */
function StudentGrades() {
  const t = useT();
  const query = useMyGrades();
  const columns: Column<MyGrade>[] = [
    {
      key: "course",
      header: t("academic.col.course"),
      sortValue: (g) => g.code,
      cell: (g) => (
        <div>
          <p className="font-medium">{g.code}</p>
          <p className="text-xs text-muted-foreground">{g.title}</p>
        </div>
      ),
    },
    { key: "teacher", header: t("academic.detail.teacher"), cell: (g) => g.teacherName },
    { key: "credits", header: t("academic.detail.credits"), sortValue: (g) => g.credits, cell: (g) => g.credits },
    {
      key: "value",
      header: t("academic.col.grade"),
      sortValue: (g) => g.value ?? -1,
      cell: (g) =>
        g.value === null ? (
          <span className="text-muted-foreground">{t("academic.grades.unpublished")}</span>
        ) : (
          <span className={cn("font-semibold", g.value < PASS_MARK ? "text-red-800" : "text-foreground")}>{fmt(g.value)} / 20</span>
        ),
    },
    {
      key: "result",
      header: t("academic.col.status"),
      cell: (g) => <StatusPill status={g.value === null ? "pending" : g.value >= PASS_MARK ? "validated" : "refused"} />,
    },
  ];
  return (
    <QueryBoundary query={query} moduleName={t("module.academic")}>
      {(s) => (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label={t("academic.grades.average")}
              value={s.average === null ? "—" : `${fmt(s.average)} / 20`}
              icon={Percent}
              tone="navy"
              hint={t("academic.grades.averageHint")}
            />
            <StatCard
              label={t("academic.grades.credits")}
              value={`${s.creditsEarned} / ${s.creditsTotal}`}
              icon={GraduationCap}
              tone="green"
            />
          </div>
          {s.items.length === 0 ? (
            <Card>
              <EmptyState icon={Award} title={t("academic.empty.grades")} />
            </Card>
          ) : (
            <DataTable caption={t("academic.grades.caption")} columns={columns} data={s.items} rowKey={(g) => g.courseId} />
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

/** Feuille de notes d'un cours : consultation pour admin, saisie et publication réservées à l'enseignant. */
function GradeSheet({ courseId, data, refetch }: { courseId: string; data: CourseGrades; refetch: () => void }) {
  const t = useT();
  const { role } = useAuth();
  const viewer = useViewer();
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const formRef = useRef<HTMLFormElement>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInputs(Object.fromEntries(data.entries.map((e) => [e.studentId, e.value === null ? "" : String(e.value).replace(".", ",")])));
    setErrors({});
  }, [data]);

  function collect(): Record<string, number | null> | undefined {
    const next: Record<string, string> = {};
    const values: Record<string, number | null> = {};
    for (const e of data.entries) {
      const raw = inputs[e.studentId] ?? "";
      const r = gradeInputSchema.safeParse(raw);
      if (!r.success) next[e.studentId] = r.error.issues[0]!.message;
      else values[e.studentId] = parseGrade(raw) as number | null;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return undefined;
    }
    return values;
  }

  async function submit(publish: boolean) {
    if (!isTeacher) {
      toast.error("Action refusée : seul l'enseignant responsable peut saisir ou publier les notes.");
      return;
    }
    const values = collect();
    if (!values) return setConfirmPublish(false);
    setBusy(true);
    try {
      await saveGrades(courseId, values, publish, viewer);
      if (!publish) toast.success(t("academic.grades.draftSaved"));
      refetch();
    } catch (e) {
      toast.error(isApiError(e) ? (e.isUnavailable ? t("error.unavailable.title") : e.message) : t("error.generic"));
    } finally {
      setBusy(false);
      setConfirmPublish(false);
    }
  }

  if (data.entries.length === 0)
    return (
      <Card>
        <EmptyState icon={Award} title={t("academic.empty.roster")} />
      </Card>
    );

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        if (!isAdmin) {
          void submit(false);
        }
      }}
      noValidate
      className="space-y-4"
    >
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("academic.grades.sheetCaption", { code: data.course.code })}</caption>
          <thead className="border-b bg-secondary/60">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">
                {t("academic.col.student")}
              </th>
              <th scope="col" className="w-48 px-4 py-3 font-semibold text-muted-foreground">
                {t("academic.col.grade")} (/20)
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">
                {t("academic.col.status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.entries.map((e) => {
              const id = `grade-${e.studentId}`;
              const err = errors[e.studentId];
              return (
                <tr key={e.studentId} className="align-top">
                  <th scope="row" className="px-4 py-3 font-medium">
                    <label htmlFor={id}>{e.studentName}</label>
                    <span className="block text-xs font-normal text-muted-foreground">{e.studentId}</span>
                  </th>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      e.value !== null ? (
                        <span className={cn("font-bold text-sm", e.value < PASS_MARK ? "text-red-700" : "text-green-700")}>
                          {fmt(e.value)} / 20
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Non renseignée</span>
                      )
                    ) : (
                      <div className="py-0">
                        <input
                          id={id}
                          inputMode="decimal"
                          autoComplete="off"
                          value={inputs[e.studentId] ?? ""}
                          aria-invalid={err ? true : undefined}
                          aria-describedby={err ? `${id}-err` : undefined}
                          onChange={(ev) => {
                            setInputs((s) => ({ ...s, [e.studentId]: ev.target.value }));
                            setErrors((s) => ({ ...s, [e.studentId]: "" }));
                          }}
                          className={cn("h-10 w-28 rounded-lg border bg-card px-3 text-sm", err ? "border-red-600" : "border-input")}
                        />
                        <p id={`${id}-err`} className="min-h-5 pt-1 text-xs text-red-700">
                          {err ? t(err) : ""}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                        e.published ? "border-green-200 bg-green-100 text-green-800" : "border-slate-200 bg-slate-100 text-slate-700",
                      )}
                    >
                      {e.published ? t("academic.grades.published") : t("academic.grades.draft")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAdmin ? (
        <div className="rounded-lg border bg-slate-50 p-3 text-xs text-muted-foreground text-center italic">
          Mode consultation administrative — La saisie, la modification et la publication des notes sont réservées à l'enseignant responsable.
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="submit" variant="outline" disabled={busy}>
            {t("academic.grades.saveDraft")}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              if (collect()) setConfirmPublish(true);
            }}
          >
            {t("academic.grades.publish")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={(o) => !busy && setConfirmPublish(o)}
        loading={busy}
        title={t("academic.grades.publishTitle", { code: data.course.code })}
        description={t("academic.grades.publishBody")}
        confirmLabel={t("academic.grades.publish")}
        onConfirm={() => submit(true)}
      />
    </form>
  );
}

function CourseGradesView({ courseId }: { courseId: string }) {
  const t = useT();
  const query = useCourseGrades(courseId);
  return (
    <QueryBoundary query={query} moduleName={t("module.academic")} skeleton={<Skeleton className="h-64 w-full rounded-xl" />}>
      {(data) => <GradeSheet courseId={courseId} data={data} refetch={query.refetch} />}
    </QueryBoundary>
  );
}

/** Enseignant (ses cours) / administrateur (tous les cours en consultation) : choix du cours puis feuille de notes. */
function TeacherGrades() {
  const t = useT();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const query = useCourses(role === "teacher" ? { teacherId: user.id, teacherName: user.name } : {});
  const [courseId, setCourseId] = useState("");
  const courses = query.data ?? [];
  const selected = useMemo(() => courseId || courses[0]?.id || "", [courseId, courses]);

  return (
    <QueryBoundary query={query} moduleName={t("module.academic")}>
      {(list) =>
        list.length === 0 ? (
          <Card>
            <EmptyState icon={Award} title={t("academic.empty.teacherCourses")} />
          </Card>
        ) : (
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 shadow-xs">
                <Award className="size-4 shrink-0 text-blue-600" />
                <span>
                  <strong>Mode consultation administrative :</strong> Seul l'enseignant responsable du cours peut saisir, enregistrer des brouillons ou publier les notes.
                </span>
              </div>
            )}

            <div className="w-full sm:w-96">
              <label htmlFor="grade-course" className="mb-1.5 block text-sm font-medium">
                {t("academic.grades.chooseCourse")}
              </label>
              <Select id="grade-course" value={selected} onChange={(e) => setCourseId(e.target.value)}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </Select>
            </div>
            <CourseGradesView key={selected} courseId={selected} />
          </div>
        )
      }
    </QueryBoundary>
  );
}

export default function GradesPage() {
  const { role } = useAuth();
  return role === "student" ? <StudentGrades /> : <TeacherGrades />;
}
