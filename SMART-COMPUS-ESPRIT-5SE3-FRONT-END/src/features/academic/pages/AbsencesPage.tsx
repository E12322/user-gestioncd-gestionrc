import { useState, useMemo } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatCard } from "@/shared/components/common/StatCard";
import { useAuth } from "@/shared/auth/AuthContext";
import { useQuery } from "@/shared/api/useQuery";
import { listAbsences, recordAbsence, getMyAbsences, listEnrollments, listGroups, deleteAbsence, updateAbsenceJustification } from "../api";
import { useCourses, useViewer } from "../hooks";
import type { Absence } from "../types";

// ─── Vue Étudiant ──────────────────────────────────────────────────────────────

function StudentAbsences() {
  const viewer = useViewer();
  const query = useQuery((sig) => getMyAbsences(viewer, sig), [viewer.id]);
  const rawAbsences = query.data ?? [];

  const absences = useMemo(() => {
    const seen = new Set<string>();
    return rawAbsences.filter((a) => {
      const dedupeKey = `${a.courseId}_${a.dateAbsence}_${a.seance}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }, [rawAbsences]);

  const unjustified = absences.filter((a) => !a.justifiee).length;
  const justified = absences.filter((a) => a.justifiee).length;

  const columns: Column<Absence>[] = [
    {
      key: "course",
      header: "Cours",
      sortValue: (a) => a.courseCode,
      cell: (a) => (
        <div>
          <p className="font-medium">{a.courseCode}</p>
          <p className="text-xs text-muted-foreground">{a.courseTitle}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortValue: (a) => a.dateAbsence,
      cell: (a) =>
        new Date(a.dateAbsence).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
    },
    {
      key: "seance",
      header: "Séance",
      cell: (a) => <span className="rounded-full border bg-secondary px-2.5 py-0.5 text-xs font-semibold">{a.seance}</span>,
    },
    {
      key: "status",
      header: "Statut",
      cell: (a) =>
        a.justifiee ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
            <CheckCircle2 className="size-3" /> Justifiée
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800">
            <XCircle className="size-3" /> Non justifiée
          </span>
        ),
    },
  ];

  return (
    <QueryBoundary query={query} moduleName="Gestion Académique" skeleton={<Skeleton className="h-64 w-full rounded-xl" />}>
      {() => (
        <div className="space-y-6">
          {/* En-tête */}
          <div className="rounded-2xl border bg-gradient-to-r from-amber-50 via-orange-50/40 to-card p-5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-700">
              <Clock className="size-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Mes absences</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-foreground">Suivi de mes absences</h2>
            <p className="mt-1 text-sm text-muted-foreground">Consultez toutes vos absences enregistrées par vos enseignants.</p>
          </div>

          {/* Statistiques */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total absences" value={String(absences.length)} icon={Clock} tone="navy" />
            <StatCard label="Non justifiées" value={String(unjustified)} icon={XCircle} tone="amber" />
            <StatCard label="Justifiées" value={String(justified)} icon={CheckCircle2} tone="green" />
          </div>

          {/* Alerte si trop d'absences */}
          {unjustified >= 3 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">⚠️ Attention : {unjustified} absences non justifiées</p>
                <p className="text-sm text-amber-800">
                  Au-delà de 3 absences non justifiées, vous risquez d'être exclu des examens. Contactez votre service de scolarité pour
                  régulariser votre situation.
                </p>
              </div>
            </div>
          )}

          {/* Tableau */}
          {absences.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="Aucune absence enregistrée"
                description="Bravo ! Votre assiduité est parfaite. Continuez ainsi !"
              />
            </Card>
          ) : (
            <DataTable caption="Historique de mes absences" columns={columns} data={absences} rowKey={(a) => a.id} />
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

// ─── Vue Enseignant / Admin ───────────────────────────────────────────────────

function TeacherAbsences() {
  const { role, user } = useAuth();
  const viewer = useViewer();
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const coursesQuery = useCourses(role === "teacher" ? { teacherId: user.id, teacherName: user.name } : {});
  const [courseId, setCourseId] = useState("");
  const [refresh, setRefresh] = useState(0);

  // Filtre de date pour la feuille d'appel du jour
  const [callDate, setCallDate] = useState(new Date().toISOString().slice(0, 10));
  const [callSeance, setCallSeance] = useState<"CM" | "TD" | "TP">("CM");
  const [savingAttendance, setSavingAttendance] = useState(false);

  const courses = coursesQuery.data ?? [];
  const selectedCourseId = courseId || courses[0]?.id || "";
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // Absences du cours sélectionné avec filtrage strict par cours et déduplication
  const absencesQuery = useQuery(
    (sig) => listAbsences({ courseId: selectedCourseId }, viewer, sig),
    [selectedCourseId, viewer.id, refresh],
  );

  const absences = useMemo(() => {
    const raw = absencesQuery.data ?? [];
    if (!selectedCourseId) return [];
    const targetNum = Number(selectedCourseId.replace(/\D/g, "")) || undefined;
    const seen = new Set<string>();

    return raw.filter((a) => {
      // 1. Filtrer strictement par le cours actuellement sélectionné
      const aCourseNum = Number(a.courseId?.replace(/\D/g, "")) || undefined;
      const matchCourse =
        a.courseId === selectedCourseId ||
        (targetNum !== undefined && aCourseNum === targetNum) ||
        (selectedCourse?.code && a.courseCode?.trim().toUpperCase() === selectedCourse.code.trim().toUpperCase());
      if (!matchCourse) return false;

      // 2. Déduplication stricte : une seule absence par étudiant pour une date et une séance données
      const dedupeKey = `${a.studentId}_${a.dateAbsence}_${a.seance}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });
  }, [absencesQuery.data, selectedCourseId, selectedCourse?.code]);

  // Étudiants inscrits au cours sélectionné (via enrollments ou liste par défaut)
  const enrollmentsQuery = useQuery((sig) => listEnrollments(viewer, sig), [viewer.id, viewer.role]);
  const groupsQuery = useQuery((sig) => listGroups(undefined, sig), []);
  const enrolledStudents = useMemo(() => {
    const all = enrollmentsQuery.data ?? [];
    const directMatches = all
      .filter((e) => (e.courseId === selectedCourseId || e.courseCode === selectedCourse?.code) && e.status === "validated")
      .map((e) => ({ id: e.studentId, name: e.studentName }));

    if (directMatches.length > 0) return directMatches;

    // Récupérer les étudiants des classes qui suivent ce cours
    const relatedGroups = (groupsQuery.data ?? []).filter(
      (g) => g.coursId === selectedCourseId || (g.affectations ?? []).some((a) => a.coursId === selectedCourseId),
    );
    const fromGroups = relatedGroups.flatMap((g) => (g.etudiants ?? []).map((et) => ({ id: String(et.etudiantId), name: et.nom })));
    if (fromGroups.length > 0) {
      const unique = new Map<string, { id: string; name: string }>();
      fromGroups.forEach((s) => unique.set(s.id, s));
      return [...unique.values()];
    }

    // Fallback dynamique : si le cours n'a pas encore d'inscriptions explicites dans la démo,
    // proposer les étudiants enregistrés dans le système pour permettre la prise d'absences
    return [
      { id: "ETU-2024-0187", name: "Yasmine Ben Salah" },
      { id: "ETU-2024-0211", name: "Amine Khelifi" },
      { id: "ETU-2024-0302", name: "Inès Bouzid" },
      { id: "ETU-2023-0644", name: "Omar Dridi" },
      { id: "ETU-2025-0019", name: "Rim Zouari" },
      { id: "ETU-2024-0455", name: "Mariem Sfaxi" },
      { id: "ETU-2025-0101", name: "Skander Ouertani" },
    ];
  }, [enrollmentsQuery.data, groupsQuery.data, selectedCourseId, selectedCourse?.code]);

  // Helper pour matcher les identifiants étudiants avec ou sans préfixe (ex. "ETU-2026-0006" et "20260006")
  const matchStudentId = (id1: string, id2: string) => {
    if (id1 === id2) return true;
    const n1 = Number(id1.replace(/\D/g, ""));
    const n2 = Number(id2.replace(/\D/g, ""));
    return n1 > 0 && n2 > 0 && n1 === n2;
  };

  // Fonction pour basculer présence/absence d'un étudiant pour la séance sélectionnée (seul l'enseignant peut saisir)
  const handleToggleAttendance = async (student: { id: string; name: string }, isCurrentlyAbsent: boolean) => {
    if (!isTeacher) {
      toast.error("Action refusée : seul l'enseignant responsable peut saisir les présences / absences.");
      return;
    }
    if (!selectedCourse) return;
    setSavingAttendance(true);
    try {
      if (isCurrentlyAbsent) {
        // Retirer l'absence — chercher l'absence correspondante et la supprimer via l'API
        const currentAbsence = absences.find(
          (a) =>
            (a.courseId === selectedCourseId || Number(a.courseId?.replace(/\D/g, "")) === Number(selectedCourseId.replace(/\D/g, ""))) &&
            matchStudentId(a.studentId, student.id) &&
            a.dateAbsence === callDate &&
            a.seance === callSeance,
        );
        if (currentAbsence) {
          try {
            await deleteAbsence(currentAbsence.id, viewer);
          } catch {
            // Fallback localStorage si le backend est indisponible
            const stored = (() => {
              try {
                return JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
              } catch {
                return [] as Absence[];
              }
            })();
            const filtered = stored.filter(
              (a) =>
                !(
                  (a.courseId === selectedCourseId || Number(a.courseId?.replace(/\D/g, "")) === Number(selectedCourseId.replace(/\D/g, ""))) &&
                  matchStudentId(a.studentId, student.id) &&
                  a.dateAbsence === callDate &&
                  a.seance === callSeance
                ),
            );
            localStorage.setItem("smartcampus.academic.absences", JSON.stringify(filtered));
          }
        }
        toast.success(`${student.name} marqué(e) Présent(e)`);
      } else {
        // Enregistrer l'absence
        await recordAbsence(
          {
            courseId: selectedCourseId,
            studentId: student.id,
            studentName: student.name,
            seance: callSeance,
            dateAbsence: callDate,
            justifiee: false,
          },
          viewer,
        );
        toast.error(`${student.name} marqué(e) Absent(e)`);
      }
      setRefresh((r) => r + 1);
      absencesQuery.refetch();
    } catch (e) {
      toast.error("Erreur de mise à jour : " + (e as Error).message);
    } finally {
      setSavingAttendance(false);
    }
  };

  // Fonction pour basculer la justification d'une absence (seul l'enseignant peut modifier)
  const handleToggleJustified = async (studentId: string) => {
    if (!isTeacher) {
      toast.error("Action refusée : seul l'enseignant responsable peut modifier la justification.");
      return;
    }
    const currentAbsence = absences.find(
      (a) =>
        (a.courseId === selectedCourseId || Number(a.courseId?.replace(/\D/g, "")) === Number(selectedCourseId.replace(/\D/g, ""))) &&
        matchStudentId(a.studentId, studentId) &&
        a.dateAbsence === callDate &&
        a.seance === callSeance,
    );
    if (!currentAbsence) return;

    const newJustifiee = !currentAbsence.justifiee;
    try {
      await updateAbsenceJustification(currentAbsence.id, newJustifiee, viewer);
      toast.info(newJustifiee ? `Absence marquée comme Justifiée` : `Absence marquée comme Non justifiée`);
    } catch {
      // Fallback localStorage si le backend est indisponible
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem("smartcampus.academic.absences") ?? "[]") as Absence[];
        } catch {
          return [] as Absence[];
        }
      })();
      const targetIdx = stored.findIndex(
        (a) =>
          (a.courseId === selectedCourseId || Number(a.courseId?.replace(/\D/g, "")) === Number(selectedCourseId.replace(/\D/g, ""))) &&
          matchStudentId(a.studentId, studentId) &&
          a.dateAbsence === callDate &&
          a.seance === callSeance,
      );
      if (targetIdx !== -1) {
        stored[targetIdx].justifiee = newJustifiee;
        localStorage.setItem("smartcampus.academic.absences", JSON.stringify(stored));
        toast.info(newJustifiee ? `Absence marquée comme Justifiée` : `Absence marquée comme Non justifiée`);
      }
    }
    setRefresh((r) => r + 1);
    absencesQuery.refetch();
  };

  const justified = absences.filter((a) => a.justifiee).length;
  const unjustified = absences.filter((a) => !a.justifiee).length;

  return (
    <QueryBoundary query={coursesQuery} moduleName="Gestion Académique">
      {(list) =>
        list.length === 0 ? (
          <Card>
            <EmptyState
              icon={BookOpen}
              title="Aucun cours affecté"
              description={isAdmin ? "Créez d'abord des cours dans l'onglet Cours." : "Vous n'avez pas encore de cours assigné."}
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {/* En-tête */}
            <div className="rounded-2xl border bg-gradient-to-r from-orange-50 via-amber-50/40 to-card p-5 shadow-xs">
              <div className="flex items-center gap-2 text-amber-700">
                <Clock className="size-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Gestion des absences</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                {isAdmin ? "Absences — Tous les cours" : "Mes cours — Suivi des absences"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAdmin
                  ? "Consultation administrative de l'assiduité des étudiants par cours."
                  : "Enregistrez et consultez les absences par cours et par étudiant."}
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 shadow-xs">
                <Clock className="size-4 shrink-0 text-blue-600" />
                <span>
                  <strong>Mode consultation administrative :</strong> La saisie et modification des présences/absences est strictement réservée à l'enseignant responsable.
                </span>
              </div>
            )}

            {/* Sélecteur de cours */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="absence-course" className="mb-1.5 block text-sm font-medium">
                  Cours sélectionné
                </label>
                <Select id="absence-course" value={selectedCourseId} onChange={(e) => setCourseId(e.target.value)}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Total absences" value={String(absences.length)} icon={Clock} tone="navy" />
              <StatCard label="Non justifiées" value={String(unjustified)} icon={XCircle} tone="amber" />
              <StatCard label="Justifiées" value={String(justified)} icon={CheckCircle2} tone="green" />
            </div>

            {/* TABLEAU UNIQUE : FEUILLE D'APPEL DIRECTE, PRÉSENCE / ABSENCE & JUSTIFICATION */}
            <Card className="border-indigo-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-foreground font-bold flex items-center gap-2">
                      <Clock className="size-4 text-indigo-600" />
                      Tableau d'Appel des Étudiants (Présences & Absences)
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gérez la présence et l'absence de chaque étudiant, avec le choix immédiat « Justifiée / Non justifiée ».
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label htmlFor="call-date" className="text-[11px] font-semibold text-muted-foreground block">
                        Date de la séance
                      </label>
                      <Input
                        id="call-date"
                        type="date"
                        value={callDate}
                        onChange={(e) => setCallDate(e.target.value)}
                        className="h-8 text-xs bg-white w-36"
                      />
                    </div>
                    <div>
                      <label htmlFor="call-seance" className="text-[11px] font-semibold text-muted-foreground block">
                        Séance
                      </label>
                      <Select
                        id="call-seance"
                        value={callSeance}
                        onChange={(e) => setCallSeance(e.target.value as "CM" | "TD" | "TP")}
                        className="h-8 text-xs bg-white w-28"
                      >
                        <option value="CM">CM</option>
                        <option value="TD">TD</option>
                        <option value="TP">TP</option>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/70 border-b text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Identifiant</th>
                        <th className="px-4 py-3 font-semibold">Nom & Prénom de l'étudiant</th>
                        <th className="px-4 py-3 text-center font-semibold">Statut actuel</th>
                        <th className="px-4 py-3 text-center font-semibold">Justification</th>
                        <th className="px-4 py-3 text-right font-semibold">Action (Présence)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {enrolledStudents.map((student) => {
                        const currentAbsence = absences.find(
                          (a) => matchStudentId(a.studentId, student.id) && a.dateAbsence === callDate && a.seance === callSeance,
                        );
                        const isAbsent = Boolean(currentAbsence);
                        const studentTotalAbsences = absences.filter((a) => matchStudentId(a.studentId, student.id)).length;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{student.id}</td>
                            <td className="px-4 py-3 font-medium text-foreground">
                              <div>{student.name}</div>
                              {studentTotalAbsences > 0 && (
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {studentTotalAbsences} absence{studentTotalAbsences > 1 ? "s" : ""} au total dans ce cours
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isAbsent ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                  <XCircle className="size-3.5" /> Absent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="size-3.5" /> Présent
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isAbsent ? (
                                isAdmin ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                      currentAbsence?.justifiee
                                        ? "border-green-300 bg-green-50 text-green-800"
                                        : "border-amber-300 bg-amber-50 text-amber-800"
                                    }`}
                                  >
                                    {currentAbsence?.justifiee ? (
                                      <>
                                        <CheckCircle2 className="size-3" /> Justifiée
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="size-3" /> Non justifiée
                                      </>
                                    )}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleJustified(student.id)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-pointer transition ${
                                      currentAbsence?.justifiee
                                        ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                                        : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                    }`}
                                    title="Cliquez pour basculer Justifiée / Non justifiée"
                                  >
                                    {currentAbsence?.justifiee ? (
                                      <>
                                        <CheckCircle2 className="size-3" /> Justifiée
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="size-3" /> Non justifiée
                                      </>
                                    )}
                                  </button>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isAdmin ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium italic">
                                  Consultation seule
                                </span>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={!isAbsent ? "default" : "outline"}
                                    disabled={savingAttendance}
                                    onClick={() => handleToggleAttendance(student, isAbsent)}
                                    className={
                                      !isAbsent
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-3 text-xs font-semibold"
                                        : "h-7 px-3 text-xs text-slate-600 hover:text-emerald-700"
                                    }
                                  >
                                    <CheckCircle2 className="mr-1 size-3" />
                                    Présent
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isAbsent ? "destructive" : "outline"}
                                    disabled={savingAttendance}
                                    onClick={() => handleToggleAttendance(student, isAbsent)}
                                    className={
                                      isAbsent
                                        ? "bg-red-600 hover:bg-red-700 text-white h-7 px-3 text-xs font-semibold"
                                        : "h-7 px-3 text-xs text-slate-600 hover:text-red-700 hover:border-red-200"
                                    }
                                  >
                                    <XCircle className="mr-1 size-3" />
                                    Absent
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
    </QueryBoundary>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function AbsencesPage() {
  const { role } = useAuth();
  return role === "student" ? <StudentAbsences /> : <TeacherAbsences />;
}
