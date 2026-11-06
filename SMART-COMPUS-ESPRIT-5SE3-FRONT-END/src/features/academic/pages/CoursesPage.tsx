import { useEffect, useState } from "react";
import { BookOpen, Search, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { CatalogList, CatalogListSkeleton } from "@/shared/components/common/CatalogRow";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";

import { CourseCard } from "../components/CourseCard";
import { CourseFormDialog } from "../components/CourseFormDialog";
import { useEnroll } from "../components/useEnroll";
import { useCourses, useViewer } from "../hooks";
import { deleteCourse } from "../api";
import { DEPARTMENTS } from "../mocks";

import type { CourseView } from "../types";

export default function CoursesPage() {
  const t = useT();
  const { user, role } = useAuth();
  const viewer = useViewer();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");

  // Modal d'ajout / modification de cours
  const [formOpen, setFormOpen] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<CourseView | null>(null);

  // Modal de confirmation de suppression
  const [courseToDelete, setCourseToDelete] = useState<CourseView | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useCourses({ q, department });
  const { enroll, pendingId, alert } = useEnroll(query.refetch);
  const filtered = Boolean(q || department);

  const handleOpenCreate = () => {
    setCourseToEdit(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (course: CourseView) => {
    setCourseToEdit(course);
    setFormOpen(true);
  };

  const handleOpenDelete = (course: CourseView) => {
    setCourseToDelete(course);
  };

  const handleExecuteDelete = async () => {
    if (!courseToDelete) return;
    setDeleting(true);
    try {
      await deleteCourse(courseToDelete.id, viewer);
      toast.success(`Le cours « ${courseToDelete.title} » a été supprimé de la base et du catalogue.`);
      setCourseToDelete(null);
      void query.refetch();
    } catch (err) {
      toast.error("Erreur lors de la suppression : " + (err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre de recherche, filtres et bouton d'ajout de cours */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="course-search" className="sr-only">
            {t("academic.search.label")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="course-search"
              type="search"
              className="pl-9"
              placeholder={t("academic.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="w-full sm:w-56">
          <label htmlFor="course-dept" className="sr-only">
            {t("academic.filter.department")}
          </label>
          <Select id="course-dept" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">{t("academic.filter.allDepartments")}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>

        {/* Bouton d'ajout d'un nouveau cours — réservé à l'admin */}
        {role === "admin" && (
          <Button onClick={handleOpenCreate} className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold shadow-xs">
            <Plus className="mr-1.5 size-4" />
            Nouveau Cours
          </Button>
        )}
      </div>

      {alert}

      <QueryBoundary query={query} moduleName={t("module.academic")} skeleton={<CatalogListSkeleton count={6} />}>
        {(courses) =>
          courses.length === 0 ? (
            <Card>
              <EmptyState icon={BookOpen} title={filtered ? t("academic.empty.noMatch") : t("academic.empty.courses")} />
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <p aria-live="polite">{t("academic.courses.count", { count: courses.length })}</p>
                {role === "admin" && (
                  <span className="text-xs text-slate-500">Actions : modifier ou supprimer un cours via les icônes de chaque fiche</span>
                )}
              </div>

              <CatalogList>
                {courses.map((c) => (
                  <CourseCard
                    key={c.id}
                    course={c}
                    canEnroll={role === "student"}
                    enrolling={pendingId === c.id}
                    onEnroll={(x) => void enroll(x)}
                    mine={c.teacherId === user.id}
                    onEdit={role === "admin" ? handleOpenEdit : undefined}
                    onDelete={role === "admin" ? handleOpenDelete : undefined}
                  />
                ))}
              </CatalogList>
            </>
          )
        }
      </QueryBoundary>

      {/* Boîte de dialogue : Formulaire d'Ajout / Modification */}
      <CourseFormDialog open={formOpen} onOpenChange={setFormOpen} courseToEdit={courseToEdit} onSuccess={() => void query.refetch()} />

      {/* Boîte de dialogue : Confirmation de Suppression */}
      <Dialog open={Boolean(courseToDelete)} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <DialogContent className="max-w-md">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-rose-100 p-2 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base text-rose-950 font-bold">Supprimer le cours ?</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Êtes-vous certain de vouloir supprimer le cours{" "}
                <span className="font-semibold text-foreground">
                  {courseToDelete?.code} - {courseToDelete?.title}
                </span>{" "}
                ? Cette action retirera le cours du catalogue académique.
              </DialogDescription>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setCourseToDelete(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleExecuteDelete}
              disabled={deleting}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              <Trash2 className="mr-1.5 size-4" />
              {deleting ? "Suppression..." : "Confirmer la suppression"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
