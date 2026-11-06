import { useMemo, useState } from "react";
import { Award, BarChart2, CheckCircle2, GraduationCap, Percent, Search, XCircle } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { useAuth } from "@/shared/auth/AuthContext";
import { useQuery } from "@/shared/api/useQuery";
import { getCourseGrades, getMyGrades, listAllNotes, listEnrollments, listGroups } from "../api";
import { useCourses, useViewer } from "../hooks";
import { PASS_MARK, type MyGrade, type GradeSummary } from "../types";

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

// ─── Vue Étudiant (Chaque étudiant voit UNIQUEMENT ses propres résultats) ────────

function StudentResults() {
  const viewer = useViewer();
  const gradesQuery = useQuery((sig) => getMyGrades(viewer, sig), [viewer.id]);

  const columns: Column<MyGrade>[] = [
    {
      key: "course",
      header: "Cours",
      sortValue: (g) => g.code,
      cell: (g) => (
        <div>
          <p className="font-medium">{g.code}</p>
          <p className="text-xs text-muted-foreground">{g.title}</p>
        </div>
      ),
    },
    { key: "teacher", header: "Enseignant", cell: (g) => g.teacherName || "—" },
    { key: "credits", header: "Crédits", sortValue: (g) => g.credits, cell: (g) => g.credits },
    {
      key: "value",
      header: "Note",
      sortValue: (g) => g.value ?? -1,
      cell: (g) =>
        g.value === null ? (
          <span className="text-sm italic text-muted-foreground">En attente</span>
        ) : (
          <span className={`font-semibold ${g.value < PASS_MARK ? "text-red-700" : "text-green-700"}`}>
            {fmt(g.value)} / 20
          </span>
        ),
    },
    {
      key: "result",
      header: "Résultat",
      cell: (g) => <StatusPill status={g.value === null ? "pending" : g.value >= PASS_MARK ? "validated" : "refused"} />,
    },
  ];

  return (
    <QueryBoundary query={gradesQuery} moduleName="Gestion Académique" skeleton={<Skeleton className="h-64 w-full rounded-xl" />}>
      {(summary: GradeSummary) => {
        const items = summary.items ?? [];
        const withGrades = items.filter((g) => g.value !== null);
        const passing = withGrades.filter((g) => g.value! >= PASS_MARK);

        return (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-gradient-to-r from-indigo-50 via-blue-50/40 to-card p-6 shadow-xs">
              <div className="flex items-center gap-2 text-indigo-700">
                <BarChart2 className="size-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Mes Résultats</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Mon bulletin de notes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Consultez vos notes persistées en base de données et votre moyenne pondérée par crédits.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Matières suivies" value={String(items.length)} icon={GraduationCap} tone="navy" />
              <StatCard
                label="Moyenne générale"
                value={summary.average !== null ? `${fmt(summary.average)} / 20` : "—"}
                icon={Percent}
                tone="navy"
              />
              <StatCard label="Matières validées" value={String(passing.length)} icon={CheckCircle2} tone="green" />
              <StatCard
                label="Crédits acquis"
                value={`${summary.creditsEarned} / ${summary.creditsTotal}`}
                icon={Award}
                tone="navy"
              />
            </div>

            {items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Award}
                  title="Aucun résultat disponible"
                  description="Vos notes apparaîtront ici une fois publiées par vos enseignants."
                />
              </Card>
            ) : (
              <DataTable caption="Mes résultats académiques" columns={columns} data={items} rowKey={(g) => g.courseId} />
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

// ─── Vue Enseignant / Admin (Résultats persistés en base de données) ──────────

interface StudentResult {
  studentId: string;
  studentName: string;
  coursesCount: number;
  gradesCount: number;
  average: number | null;
  creditsEarned: number;
  creditsTotal: number;
  status: "validated" | "pending" | "refused";
}

function AdminTeacherResults() {
  const { role, user } = useAuth();
  const viewer = useViewer();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail">("all");

  const enrollmentsQuery = useQuery((sig) => listEnrollments(viewer, sig), [viewer.id, viewer.role]);
  const groupsQuery = useQuery((sig) => listGroups(undefined, sig), []);
  const allNotesQuery = useQuery((sig) => listAllNotes(sig), []);
  const coursesQuery = useCourses(role === "teacher" ? { teacherId: user.id, teacherName: user.name } : {});
  const courses = coursesQuery.data ?? [];

  // Charger les notes de chaque cours via les endpoints de l'API
  const allCoursesGradesQuery = useQuery(
    async (sig) => {
      const courseList = courses.length > 0 ? courses : [];
      const results = await Promise.allSettled(
        courseList.map((c) => getCourseGrades(c.id, viewer, sig)),
      );
      const gradesMap = new Map<string, number | null>();
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value?.entries) {
          result.value.entries.forEach((entry) => {
            const courseKey = courseList[i].id;
            gradesMap.set(`${courseKey}:${entry.studentId}`, entry.value);
            // Associer aussi par identifiant numérique
            const numC = Number(courseKey.replace(/\D/g, ""));
            const numS = Number(entry.studentId.replace(/\D/g, ""));
            if (numC && numS) {
              gradesMap.set(`${numC}:${numS}`, entry.value);
            }
          });
        }
      });
      return gradesMap;
    },
    [courses.map((c) => c.id).join(","), viewer.id],
  );

  const gradesMap = allCoursesGradesQuery.data ?? new Map<string, number | null>();
  const dbNotes = allNotesQuery.data ?? [];

  // Reconstituer tous les étudiants et leurs résultats réels
  const studentResults = useMemo<StudentResult[]>(() => {
    const enrollments = enrollmentsQuery.data ?? [];
    const groups = groupsQuery.data ?? [];

    // Map des étudiants : studentId -> { name, courseIds: Set }
    const studentsMap = new Map<string, { id: string; name: string; courseIds: Set<string> }>();

    // 1. Ajouter depuis les inscriptions réelles
    enrollments.forEach((e) => {
      if (!studentsMap.has(e.studentId)) {
        studentsMap.set(e.studentId, { id: e.studentId, name: e.studentName, courseIds: new Set() });
      }
      if (e.status === "validated" || !e.status) {
        studentsMap.get(e.studentId)!.courseIds.add(e.courseId);
      }
    });

    // 2. Ajouter depuis les classes / groupes
    groups.forEach((g) => {
      const coursIds = [
        ...(g.coursId ? [String(g.coursId)] : []),
        ...((g.affectations ?? []).map((a) => String(a.coursId))),
      ];
      (g.etudiants ?? []).forEach((et) => {
        const sId = String(et.etudiantId);
        if (!studentsMap.has(sId)) {
          studentsMap.set(sId, { id: sId, name: et.nom, courseIds: new Set() });
        }
        coursIds.forEach((cId) => studentsMap.get(sId)!.courseIds.add(cId));
      });
    });

    // 3. Ajouter depuis les notes enregistrées en base PostgreSQL
    dbNotes.forEach((n) => {
      if (n.etudiantId) {
        const sId = String(n.etudiantId);
        if (!studentsMap.has(sId)) {
          studentsMap.set(sId, { id: sId, name: n.etudiantNom || `Étudiant #${n.etudiantId}`, courseIds: new Set() });
        }
        if (n.coursId) {
          studentsMap.get(sId)!.courseIds.add(String(n.coursId));
        }
      }
    });

    // Calculer le résultat consolidé pour chaque étudiant
    return Array.from(studentsMap.values())
      .map((student) => {
        // Filtrer par matière si un filtre est actif
        let applicableCourses = courses;
        if (courseFilter) {
          const filterNum = Number(courseFilter.replace(/\D/g, ""));
          applicableCourses = courses.filter(
            (c) => c.id === courseFilter || Number(c.id.replace(/\D/g, "")) === filterNum,
          );
        }

        // Si l'étudiant est rattaché à des cours spécifiques, ne prendre que ses cours
        if (student.courseIds.size > 0 && !courseFilter) {
          applicableCourses = courses.filter((c) => {
            const cNum = Number(c.id.replace(/\D/g, ""));
            return (
              student.courseIds.has(c.id) ||
              Array.from(student.courseIds).some((id) => Number(id.replace(/\D/g, "")) === cNum)
            );
          });
          // Si aucun cours officiel ne matche, garder les cours disponibles
          if (applicableCourses.length === 0) applicableCourses = courses;
        }

        let totalCredits = 0;
        let earnedCredits = 0;
        let weightedSum = 0;
        let gradesCount = 0;

        applicableCourses.forEach((course) => {
          const credits = course.credits ?? 3;
          totalCredits += credits;

          const sNum = Number(student.id.replace(/\D/g, ""));
          const cNum = Number(course.id.replace(/\D/g, ""));

          // 1. Chercher d'abord dans les notes persistées en base PostgreSQL
          const dbNote = dbNotes.find(
            (n) =>
              (n.etudiantId === sNum || String(n.etudiantId) === student.id) &&
              (n.coursId === cNum || String(n.coursId) === course.id),
          );

          // 2. Sinon chercher dans la map des notes de cours
          const mapGrade =
            gradesMap.get(`${course.id}:${student.id}`) ??
            (cNum && sNum ? gradesMap.get(`${cNum}:${sNum}`) : undefined);

          const finalGrade = dbNote?.valeur !== undefined ? dbNote.valeur : mapGrade;

          if (finalGrade !== undefined && finalGrade !== null && typeof finalGrade === "number") {
            gradesCount++;
            weightedSum += finalGrade * credits;
            if (finalGrade >= PASS_MARK) earnedCredits += credits;
          }
        });

        const creditsForAvg = applicableCourses.reduce((sum, c) => sum + (c.credits ?? 3), 0);
        const average = gradesCount > 0 && creditsForAvg > 0 ? weightedSum / creditsForAvg : null;

        return {
          studentId: student.id,
          studentName: student.name,
          coursesCount: applicableCourses.length,
          gradesCount,
          average,
          creditsEarned: earnedCredits,
          creditsTotal: totalCredits,
          status: average === null ? "pending" : average >= PASS_MARK ? "validated" : "refused",
        } as StudentResult;
      })
      .filter((r) => r.coursesCount > 0);
  }, [enrollmentsQuery.data, groupsQuery.data, dbNotes, courses, courseFilter, gradesMap]);

  const filtered = useMemo(() => {
    return studentResults.filter((r) => {
      const matchSearch =
        !search || r.studentName.toLowerCase().includes(search.toLowerCase()) || r.studentId.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "pass" && r.average !== null && r.average >= PASS_MARK) ||
        (statusFilter === "fail" && r.average !== null && r.average < PASS_MARK);
      return matchSearch && matchStatus;
    });
  }, [studentResults, search, statusFilter]);

  const stats = useMemo(() => {
    const withGrades = studentResults.filter((r) => r.average !== null);
    const passing = withGrades.filter((r) => r.average! >= PASS_MARK);
    const globalAvg = withGrades.length ? withGrades.reduce((s, r) => s + r.average!, 0) / withGrades.length : null;
    return {
      total: studentResults.length,
      passing: passing.length,
      failing: withGrades.length - passing.length,
      pending: studentResults.filter((r) => r.average === null).length,
      globalAvg,
    };
  }, [studentResults]);

  const columns: Column<StudentResult>[] = [
    {
      key: "student",
      header: "Étudiant",
      sortValue: (r) => r.studentName,
      cell: (r) => (
        <div>
          <p className="font-medium">{r.studentName}</p>
          <p className="text-xs text-muted-foreground">{r.studentId}</p>
        </div>
      ),
    },
    {
      key: "courses",
      header: "Matières",
      sortValue: (r) => r.coursesCount,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
          {r.gradesCount} / {r.coursesCount} notée(s)
        </span>
      ),
    },
    {
      key: "credits",
      header: "Crédits validés",
      sortValue: (r) => r.creditsEarned,
      cell: (r) => (
        <span className="font-semibold text-sm">
          {r.creditsEarned} / {r.creditsTotal}
        </span>
      ),
    },
    {
      key: "average",
      header: "Moyenne générale",
      sortValue: (r) => r.average ?? -1,
      cell: (r) =>
        r.average === null ? (
          <span className="text-sm italic text-muted-foreground">En attente</span>
        ) : (
          <span className={`text-base font-bold ${r.average >= PASS_MARK ? "text-green-700" : "text-red-700"}`}>{fmt(r.average)} / 20</span>
        ),
    },
    {
      key: "status",
      header: "Décision du jury",
      cell: (r) => <StatusPill status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-blue-50/40 to-card p-6 shadow-xs">
        <div className="flex items-center gap-2 text-indigo-700">
          <BarChart2 className="size-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Résultats Académiques</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {role === "admin" ? "Tableau de bord consolidé des résultats" : "Résultats de mes étudiants"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Performances académiques consolidées, moyennes pondérées et crédits ECTS persistés en base de données PostgreSQL.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total étudiants" value={String(stats.total)} icon={GraduationCap} tone="navy" />
          <StatCard
            label="Moyenne de promotion"
            value={stats.globalAvg !== null ? `${fmt(stats.globalAvg)} / 20` : "—"}
            icon={Percent}
            tone="navy"
          />
          <StatCard label="Admis (≥ 10)" value={String(stats.passing)} icon={CheckCircle2} tone="green" />
          <StatCard label="Ajournés (< 10)" value={String(stats.failing)} icon={XCircle} tone="amber" />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou identifiant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-56">
            <option value="">Tous les cours</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "pass" | "fail")} className="w-44">
            <option value="all">Tous les statuts</option>
            <option value="pass">Admis (≥ 10)</option>
            <option value="fail">En échec (&lt; 10)</option>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Award}
              title="Aucun résultat trouvé"
              description="Aucun étudiant n'a encore de notes enregistrées dans la base de données pour les filtres sélectionnés."
            />
          </Card>
        ) : (
          <DataTable caption="Résultats académiques consolidés" columns={columns} data={filtered} rowKey={(r) => r.studentId} />
        )}
      </div>
    </div>
  );
}

// ─── Export Principal ──────────────────────────────────────────────────────────

export default function AcademicResultsPage() {
  const { role } = useAuth();
  return role === "student" ? <StudentResults /> : <AdminTeacherResults />;
}
