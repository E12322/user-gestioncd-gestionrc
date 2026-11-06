import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ListChecks, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { isApiError } from "@/shared/api/errors";
import { useQuery } from "@/shared/api/useQuery";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { PageHeader } from "@/shared/components/common/PageHeader";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { useT } from "@/shared/i18n";
import {
  affecterCours,
  ajouterEtudiant,
  createGroup,
  deleteGroup,
  listAcademicCourses,
  listGroups,
  retirerAffectation,
  retirerEtudiant,
  updateGroup,
} from "../api";
import type { AffectationInfo, EtudiantRef, GroupInfo, SessionKind } from "../types";

/** Habillage des types de groupe (CM / TD / TP). */
const KIND_STYLES: Record<SessionKind, string> = {
  CM: "border-blue-200 bg-blue-100 text-blue-950",
  TD: "border-amber-200 bg-amber-100 text-amber-950",
  TP: "border-purple-200 bg-purple-100 text-purple-950",
};
const KIND_LABEL: Record<SessionKind, string> = { CM: "Cours", TD: "TD", TP: "TP" };

interface GroupForm {
  nom: string;
  coursId: string;
  kind: SessionKind;
  capacite: string;
}

const EMPTY_FORM: GroupForm = { nom: "", coursId: "", kind: "TD", capacite: "25" };

/** Référentiel des groupes (TD/TP), servi par le backend ( /academic/v1/groups ). */
export default function GroupsPage() {
  const t = useT();
  const groups = useQuery((signal) => listGroups(undefined, signal), []);
  const courses = useQuery((signal) => listAcademicCourses(signal), []);

  const [search, setSearch] = useState("");
  const [filterCours, setFilterCours] = useState("");

  // Dialog création / édition
  const [editing, setEditing] = useState<GroupInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Étapes de création : 1 = Infos, 2 = Étudiants, 3 = Cours, 4 = Récapitulatif capacités
  const [creationStep, setCreationStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardStudents, setWizardStudents] = useState<Array<{ etudiantId: string; nom: string }>>([]);
  const [wizardStudentName, setWizardStudentName] = useState("");
  const [wizardStudentId, setWizardStudentId] = useState("");
  const [wizardCourses, setWizardCourses] = useState<Array<{ coursId: string; kind: SessionKind }>>([]);
  const [wizardCourseId, setWizardCourseId] = useState("");
  const [wizardCourseKind, setWizardCourseKind] = useState<SessionKind>("CM");

  // Suppression
  const [toDelete, setToDelete] = useState<GroupInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Membres de la classe (étudiants) — l'objet est dérivé des données à jour
  const [membresOpen, setMembresOpen] = useState(false);
  const [membresTargetId, setMembresTargetId] = useState<string | null>(null);
  const [membreNom, setMembreNom] = useState("");
  const [membreId, setMembreId] = useState("");
  const [membreAdding, setMembreAdding] = useState(false);
  const [membreRemoving, setMembreRemoving] = useState<string | null>(null);

  // Cours affectés (tableau façon démo)
  const [affectOpen, setAffectOpen] = useState(false);
  const [affectTargetId, setAffectTargetId] = useState<string | null>(null);
  const [affectCoursId, setAffectCoursId] = useState("");
  const [affectKind, setAffectKind] = useState<SessionKind>("CM");
  const [affectSaving, setAffectSaving] = useState(false);
  const [affectRemoving, setAffectRemoving] = useState<string | null>(null);

  const navigate = useNavigate();

  const coursParId = useMemo(() => new Map((courses.data ?? []).map((c) => [String(c.id), c])), [courses.data]);

  /** Classe affichée dans le dialog membres, toujours synchronisée avec les données rechargées. */
  const membresTarget = useMemo(() => (groups.data ?? []).find((g) => g.id === membresTargetId) ?? null, [groups.data, membresTargetId]);

  /** Cours déjà affectés de la classe ciblée par le dialog d'affectation. */
  const affectationsCible = useMemo(
    () => (groups.data ?? []).find((g) => g.id === affectTargetId)?.affectations ?? null,
    [groups.data, affectTargetId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (groups.data ?? [])
      .filter((g) => (!filterCours || g.coursId === filterCours) && (!q || g.nom.toLowerCase().includes(q)))
      .sort((a, b) => a.nom.localeCompare(b.nom) || (a.coursId ?? "").localeCompare(b.coursId ?? ""));
  }, [groups.data, search, filterCours]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCreationStep(1);
    setWizardStudents([]);
    setWizardCourses([]);
    setWizardStudentName("");
    setWizardStudentId("");
    setWizardCourseId("");
    setWizardCourseKind("CM");
    setDialogOpen(true);
  };

  /** Bouton « + Sous-groupe » d'une carte : crée une classe du même cours. */
  const openCreateSousGroupe = (g: GroupInfo) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, coursId: g.coursId || "", kind: g.kind });
    setCreationStep(1);
    setWizardStudents([]);
    setWizardCourses([]);
    setDialogOpen(true);
  };

  const openEdit = (g: GroupInfo) => {
    setEditing(g);
    setForm({ nom: g.nom, coursId: g.coursId || "", kind: g.kind, capacite: String(g.capacite) });
    setDialogOpen(true);
  };

  const handleAddWizardStudent = () => {
    if (!wizardStudentName.trim() || !wizardStudentId.trim() || !Number(wizardStudentId)) {
      toast.error("Veuillez saisir un nom et un identifiant numérique valide.");
      return;
    }
    const cleanId = wizardStudentId.trim();
    if (wizardStudents.some((st) => st.etudiantId === cleanId)) {
      toast.error("Cet étudiant est déjà dans la liste.");
      return;
    }
    const maxCap = Number(form.capacite) || 25;
    if (wizardStudents.length >= maxCap) {
      toast.error(`La capacité maximale du groupe (${maxCap} places) est atteinte.`);
      return;
    }
    setWizardStudents((prev) => [...prev, { etudiantId: cleanId, nom: wizardStudentName.trim() }]);
    setWizardStudentName("");
    setWizardStudentId("");
  };

  const handleRemoveWizardStudent = (id: string) => {
    setWizardStudents((prev) => prev.filter((st) => st.etudiantId !== id));
  };

  const handleAddWizardCourse = () => {
    if (!wizardCourseId) {
      toast.error("Veuillez sélectionner un cours à affecter.");
      return;
    }
    if (wizardCourses.some((c) => c.coursId === wizardCourseId)) {
      toast.error("Ce cours est déjà affecté au groupe.");
      return;
    }
    setWizardCourses((prev) => [...prev, { coursId: wizardCourseId, kind: wizardCourseKind }]);
    setWizardCourseId("");
  };

  const handleRemoveWizardCourse = (id: string) => {
    setWizardCourses((prev) => prev.filter((c) => c.coursId !== id));
  };

  const handleFinalizeGroupCreation = async () => {
    const capacite = Number(form.capacite);
    if (!form.nom.trim() || !Number.isFinite(capacite) || capacite < 1) {
      toast.error(t("groups.form.required"));
      return;
    }
    setSubmitting(true);
    try {
      const created = await createGroup({
        nom: form.nom.trim(),
        kind: form.kind,
        capacite,
        coursId: form.coursId || undefined,
      });

      // 1. Ajouter les étudiants (génère automatiquement les inscriptions)
      for (const st of wizardStudents) {
        try {
          await ajouterEtudiant(String(created.id), st);
        } catch (err) {
          console.warn("Ajout étudiant:", err);
        }
      }

      // 2. Affecter les cours sélectionnés
      for (const co of wizardCourses) {
        if (form.coursId && co.coursId === form.coursId) continue;
        try {
          await affecterCours(String(created.id), { coursId: co.coursId, kind: co.kind });
        } catch (err) {
          console.warn("Affectation cours:", err);
        }
      }

      toast.success(`Groupe « ${form.nom.trim()} » créé avec succès (${wizardStudents.length} étudiant(s), ${wizardCourses.length} cours affecté(s)) !`);
      setDialogOpen(false);
      groups.refetch();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    const capacite = Number(form.capacite);
    if (!form.nom.trim() || !form.coursId || !Number.isFinite(capacite) || capacite < 1) {
      toast.error(t("groups.form.required"));
      return;
    }
    setSubmitting(true);
    try {
      const input = { nom: form.nom, coursId: form.coursId, kind: form.kind, capacite };
      if (editing) {
        await updateGroup(editing.id, input);
        toast.success(t("groups.updated", { name: form.nom.trim() }));
      } else {
        await createGroup(input);
        toast.success(t("groups.created", { name: form.nom.trim() }));
      }
      setDialogOpen(false);
      groups.refetch();
    } catch (e) {
      // 409 (nom dupliqué) ou règle métier (capacité > cours) : message exact du backend.
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteGroup(toDelete.id);
      toast.success(t("groups.deleted", { name: toDelete.nom }));
      setToDelete(null);
      groups.refetch();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setDeleting(false);
    }
  };

  const openMembres = (g: GroupInfo) => {
    setMembresTargetId(g.id);
    setMembreNom("");
    setMembreId("");
    setMembresOpen(true);
  };

  const handleAddMembre = async () => {
    if (!membresTargetId) return;
    if (!membreNom.trim() || !membreId.trim() || !Number(membreId)) {
      toast.error(t("groups.members.required"));
      return;
    }
    setMembreAdding(true);
    try {
      await ajouterEtudiant(membresTargetId, { etudiantId: membreId.trim(), nom: membreNom });
      toast.success(t("groups.members.added", { name: membreNom.trim(), classe: membresTarget?.nom ?? "" }));
      setMembreNom("");
      setMembreId("");
      groups.refetch();
    } catch (e) {
      // 409 : classe complète ou étudiant déjà membre — message exact du backend.
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setMembreAdding(false);
    }
  };

  const handleRemoveMembre = async (membre: EtudiantRef) => {
    if (!membresTargetId) return;
    setMembreRemoving(membre.etudiantId);
    try {
      await retirerEtudiant(membresTargetId, membre.etudiantId);
      toast.success(t("groups.members.removed", { name: membre.nom }));
      groups.refetch();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setMembreRemoving(null);
    }
  };

  const openAffectCours = (g: GroupInfo) => {
    setAffectTargetId(g.id);
    setAffectCoursId("");
    setAffectKind("CM");
    setAffectOpen(true);
  };

  const handleAffectCours = async () => {
    if (!affectTargetId) return;
    if (!affectCoursId) {
      toast.error(t("groups.affected.required"));
      return;
    }
    setAffectSaving(true);
    try {
      await affecterCours(affectTargetId, { coursId: affectCoursId, kind: affectKind });
      const cours = coursParId.get(affectCoursId);
      toast.success(t("groups.affected.added", { course: cours?.intitule ?? affectCoursId }));
      setAffectOpen(false);
      groups.refetch();
    } catch (e) {
      // 409 : cours déjà affecté — message exact du backend.
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setAffectSaving(false);
    }
  };

  const handleRetirerAffectation = async (g: GroupInfo, coursId: string) => {
    setAffectRemoving(coursId);
    try {
      await retirerAffectation(g.id, coursId);
      toast.success(t("groups.affected.removed"));
      groups.refetch();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : t("error.generic"));
    } finally {
      setAffectRemoving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("groups.title")}
        description={t("groups.subtitle")}
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus aria-hidden="true" />
            {t("groups.add")}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="search" placeholder={t("groups.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select
          aria-label={t("groups.filterCourse")}
          className="w-auto"
          value={filterCours}
          onChange={(e) => setFilterCours(e.target.value)}
        >
          <option value="">{t("groups.filterCourse.all")}</option>
          {(courses.data ?? []).map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.code ? `${c.code} — ` : ""}
              {c.intitule}
            </option>
          ))}
        </Select>
      </div>

      <QueryBoundary query={groups} moduleName={t("module.academic")}>
        {() =>
          filtered.length === 0 ? (
            <Card>
              <EmptyState
                title={t("groups.empty")}
                description={t("groups.empty.hint")}
                icon={Users}
                action={
                  <Button onClick={openCreate} className="gap-1.5">
                    <Plus aria-hidden="true" />
                    {t("groups.add")}
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((g) => {
                const cours = g.coursId ? coursParId.get(g.coursId) : undefined;
                const effectif = g.etudiants?.length ?? g.effectif ?? 0;
                const places = `${effectif} / ${g.capacite}`;
                const affectations: AffectationInfo[] = g.affectations?.length
                  ? g.affectations
                  : cours && g.coursId
                    ? [
                        {
                          coursId: g.coursId,
                          coursCode: cours.code,
                          coursIntitule: cours.intitule,
                          enseignantNom: cours.enseignantNom,
                          kind: g.kind,
                        },
                      ]
                    : [];
                /** Autres classes du même cours (sous-groupes façon démo). */
                const sousGroupes = g.coursId
                  ? (groups.data ?? [])
                      .filter((x) => x.coursId === g.coursId && x.id !== g.id)
                      .sort((a, b) => a.nom.localeCompare(b.nom))
                  : [];
                return (
                  <Card key={g.id} className="flex flex-col gap-2.5 p-4">
                    {/* En-tête : nom + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-extrabold tracking-tight">{g.nom}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(g)} title={t("common.edit")}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-700 hover:bg-red-100 hover:text-red-900"
                          onClick={() => setToDelete(g)}
                          title={t("common.delete")}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[
                        cours?.departement || "Tronc commun",
                        cours?.semestre ? t("groups.card.semester", { semester: String(cours.semestre).replace(/^S/, "") }) : null,
                        t("groups.members.countShort", { count: effectif }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    {/* Sous-groupes : autres classes du même cours */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-foreground">{t("groups.subgroups")}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {sousGroupes.length === 0 && <span className="text-2xs text-muted-foreground">{t("groups.subgroups.empty")}</span>}
                        {sousGroupes.slice(0, 3).map((s) => (
                          <span
                            key={s.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-2xs font-bold text-emerald-900"
                          >
                            {s.nom} · {s.etudiants?.length ?? s.effectif ?? 0} {t("groups.card.students")}
                          </span>
                        ))}
                        {sousGroupes.length > 3 && (
                          <span className="text-2xs font-medium text-muted-foreground">+{sousGroupes.length - 3}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => openCreateSousGroupe(g)}
                          className="rounded-lg border border-dashed px-2 py-1 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                        >
                          + {t("groups.subgroups.add")}
                        </button>
                      </div>
                    </div>

                    {/* Cours affectés : tableau façon démo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground">{t("groups.affected")}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 border-slate-300 px-2 text-2xs font-semibold"
                          onClick={() => openAffectCours(g)}
                        >
                          <Plus className="size-3" aria-hidden="true" />
                          {t("groups.affected.add")}
                        </Button>
                      </div>

                      {affectations.length === 0 ? (
                        <p className="py-2 text-center text-2xs text-muted-foreground">{t("groups.affected.empty")}</p>
                      ) : (
                        <div className="overflow-hidden rounded-lg border">
                          <table className="w-full text-2xs">
                            <thead>
                              <tr className="bg-muted/60 text-muted-foreground">
                                <th className="p-1.5 text-left font-semibold">{t("groups.affected.course")}</th>
                                <th className="p-1.5 text-left font-semibold">{t("groups.affected.typeLabel")}</th>
                                <th className="p-1.5 text-left font-semibold">{t("groups.affected.teacher")}</th>
                                <th className="p-1.5 text-right font-semibold">{t("groups.affected.seats")}</th>
                                <th className="w-6 p-1.5" aria-hidden="true" />
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {affectations.map((a) => (
                                <tr key={a.coursId} className="bg-card">
                                    <td className="max-w-[120px] truncate p-1.5 font-medium">
                                      {a.coursCode ? `${a.coursCode} — ` : ""}
                                      {a.coursIntitule}
                                    </td>
                                    <td className="p-1.5">
                                      <span
                                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_STYLES[a.kind]}`}
                                      >
                                        {KIND_LABEL[a.kind] ?? a.kind}
                                      </span>
                                    </td>
                                    <td className="max-w-[90px] truncate p-1.5 text-muted-foreground">
                                      {a.enseignantNom || cours?.enseignantNom || "—"}
                                    </td>
                                    <td className="p-1.5 text-right font-semibold">{places}</td>
                                    <td className="p-1">
                                      {a.coursId === g.coursId ? null : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-muted-foreground hover:text-red-700"
                                          onClick={() => void handleRetirerAffectation(g, a.coursId)}
                                          disabled={affectRemoving === a.coursId}
                                          title={t("groups.affected.remove")}
                                        >
                                          <X className="size-3" aria-hidden="true" />
                                        </Button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Actions principales façon démo */}
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-9 gap-1.5 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
                        onClick={() => navigate(`/academique/emploi-du-temps?group=${g.id}`)}
                      >
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {t("groups.viewTimetable")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-slate-300 text-xs font-semibold"
                        onClick={() => openMembres(g)}
                      >
                        <ListChecks className="size-3.5" aria-hidden="true" />
                        {t("groups.studentList")}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        }
      </QueryBoundary>

      {/* Dialog création en étapes / édition directe */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={editing ? "max-w-md" : "max-w-xl"}>
          <DialogTitle>
            {editing ? t("groups.edit") : "Création d'un Groupe — Affectation & Inscriptions"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? t("groups.form.description")
              : "Créez la classe, intégrez les étudiants et affectez les cours avec contrôle immédiat des capacités."}
          </DialogDescription>

          {editing ? (
            /* Mode Édition Simple */
            <div className="grid gap-3 py-2">
              <label className="grid gap-1 text-sm">
                {t("groups.form.name")}
                <Input value={form.nom} placeholder="5SE3" onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                {t("groups.form.course")}
                <Select value={form.coursId} onChange={(e) => setForm((f) => ({ ...f, coursId: e.target.value }))}>
                  <option value="">— Aucun (cours gérés par affectations) —</option>
                  {(courses.data ?? []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code ? `${c.code} — ` : ""}
                      {c.intitule}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">
                  {t("groups.form.kind")}
                  <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as SessionKind }))}>
                    <option value="CM">{KIND_LABEL.CM}</option>
                    <option value="TD">{KIND_LABEL.TD}</option>
                    <option value="TP">{KIND_LABEL.TP}</option>
                  </Select>
                </label>
                <label className="grid gap-1 text-sm">
                  {t("groups.form.capacity")}
                  <Input type="number" min={1} value={form.capacite} onChange={(e) => setForm((f) => ({ ...f, capacite: e.target.value }))} />
                </label>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={submitting}>
                  {submitting ? t("common.saving") : t("common.save")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Mode Assistant Multi-Étapes */
            <div className="space-y-4 py-2">
              {/* Stepper Header */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
                <div className={`rounded-lg p-2 border transition-colors ${creationStep === 1 ? "bg-indigo-50 border-indigo-300 text-indigo-700" : creationStep > 1 ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 text-muted-foreground"}`}>
                  1. Groupe
                </div>
                <div className={`rounded-lg p-2 border transition-colors ${creationStep === 2 ? "bg-indigo-50 border-indigo-300 text-indigo-700" : creationStep > 2 ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 text-muted-foreground"}`}>
                  2. Étudiants
                </div>
                <div className={`rounded-lg p-2 border transition-colors ${creationStep === 3 ? "bg-indigo-50 border-indigo-300 text-indigo-700" : creationStep > 3 ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-slate-50 text-muted-foreground"}`}>
                  3. Cours
                </div>
                <div className={`rounded-lg p-2 border transition-colors ${creationStep === 4 ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 text-muted-foreground"}`}>
                  4. Capacités
                </div>
              </div>

              {/* Étape 1 : Informations du groupe */}
              {creationStep === 1 && (
                <div className="grid gap-3 pt-2">
                  <label className="grid gap-1 text-sm font-medium">
                    Nom de la classe / groupe *
                    <Input value={form.nom} placeholder="ex. 5SE3" onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Type de séance principal
                      <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as SessionKind }))}>
                        <option value="CM">Cours (CM)</option>
                        <option value="TD">Travaux Dirigés (TD)</option>
                        <option value="TP">Travaux Pratiques (TP)</option>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Capacité maximale *
                      <Input type="number" min={1} value={form.capacite} onChange={(e) => setForm((f) => ({ ...f, capacite: e.target.value }))} />
                    </label>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                    <Button
                      onClick={() => {
                        if (!form.nom.trim()) {
                          toast.error("Veuillez renseigner le nom du groupe.");
                          return;
                        }
                        setCreationStep(2);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Suivant : Étudiants →
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* Étape 2 : Étudiants du groupe */}
              {creationStep === 2 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Membres du groupe (reçoivent automatiquement les inscriptions aux cours)</span>
                    <span className="font-bold text-foreground">{wizardStudents.length} / {form.capacite} inscrits</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50/70 p-2.5">
                    <Input
                      className="col-span-2 text-xs bg-white"
                      placeholder="Nom complet (ex: Ahlem Guesmi)"
                      value={wizardStudentName}
                      onChange={(e) => setWizardStudentName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddWizardStudent()}
                    />
                    <Input
                      className="text-xs bg-white"
                      placeholder="Identifiant (ex: 20260006)"
                      value={wizardStudentId}
                      onChange={(e) => setWizardStudentId(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleAddWizardStudent()}
                    />
                    <div className="col-span-3 flex justify-end">
                      <Button size="sm" type="button" onClick={handleAddWizardStudent} className="h-7 text-xs gap-1">
                        <UserPlus className="size-3" /> Ajouter au groupe
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-white">
                    {wizardStudents.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-3">Aucun étudiant encore ajouté. Ajoutez au moins un étudiant ou poursuivez pour l'ajouter plus tard.</p>
                    ) : (
                      wizardStudents.map((st) => (
                        <div key={st.etudiantId} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border text-xs">
                          <span className="font-semibold">{st.nom} <span className="font-mono text-muted-foreground">#{st.etudiantId}</span></span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => handleRemoveWizardStudent(st.etudiantId)}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setCreationStep(1)}>← Précédent</Button>
                    <Button onClick={() => setCreationStep(3)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Suivant : Cours affectés →
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* Étape 3 : Cours du groupe */}
              {creationStep === 3 && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">Sélectionnez les cours suivis par cette classe (chaque affectation inscrit le groupe entier).</p>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50/70 p-2.5">
                    <div className="col-span-2">
                      <Select value={wizardCourseId} onChange={(e) => setWizardCourseId(e.target.value)} className="text-xs bg-white">
                        <option value="">— Choisir un cours —</option>
                        {(courses.data ?? [])
                          .filter((c) => !wizardCourses.some((wc) => wc.coursId === String(c.id)))
                          .map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.code ? `${c.code} — ` : ""}{c.intitule}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <div>
                      <Select value={wizardCourseKind} onChange={(e) => setWizardCourseKind(e.target.value as SessionKind)} className="text-xs bg-white">
                        <option value="CM">CM</option>
                        <option value="TD">TD</option>
                        <option value="TP">TP</option>
                      </Select>
                    </div>
                    <div className="col-span-3 flex justify-end">
                      <Button size="sm" type="button" onClick={handleAddWizardCourse} className="h-7 text-xs gap-1">
                        <Plus className="size-3" /> Affecter ce cours
                      </Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-white">
                    {wizardCourses.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-3">Aucun cours sélectionné pour le moment.</p>
                    ) : (
                      wizardCourses.map((wc) => {
                        const co = coursParId.get(wc.coursId);
                        return (
                          <div key={wc.coursId} className="flex items-center justify-between p-1.5 bg-slate-50 rounded border text-xs">
                            <div>
                              <span className="font-semibold">{co?.code ? `${co.code} — ` : ""}{co?.intitule ?? wc.coursId}</span>
                              <span className="ml-2 rounded-full border px-1.5 py-0.2 text-[10px] font-bold bg-indigo-50 text-indigo-700">{wc.kind}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={() => handleRemoveWizardCourse(wc.coursId)}>
                              <X className="size-3" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setCreationStep(2)}>← Précédent</Button>
                    <Button onClick={() => setCreationStep(4)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      Suivant : Récapitulatif Capacités →
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* Étape 4 : Récapitulatif des capacités */}
              {creationStep === 4 && (
                <div className="space-y-3 pt-2">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-900">
                    <p className="font-bold text-sm text-indigo-950 mb-1">Synthèse de la classe « {form.nom} »</p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div><span className="text-muted-foreground">Type :</span> <strong>{form.kind}</strong></div>
                      <div><span className="text-muted-foreground">Capacité max :</span> <strong>{form.capacite} places</strong></div>
                      <div><span className="text-muted-foreground">Effectif initial :</span> <strong>{wizardStudents.length} étudiants</strong></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-foreground">Contrôle des capacités des cours affectés :</p>
                    {wizardCourses.length === 0 ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Aucun cours affecté pour l'instant. Vous pourrez en affecter ultérieurement.</p>
                    ) : (
                      <div className="border rounded-lg divide-y bg-white">
                        {wizardCourses.map((wc) => {
                          const co = coursParId.get(wc.coursId);
                          const courseCap = co?.capacite ?? 40;
                          const valide = wizardStudents.length <= courseCap;
                          return (
                            <div key={wc.coursId} className="flex items-center justify-between p-2 text-xs">
                              <div>
                                <p className="font-semibold text-foreground">{co?.code ? `${co.code} — ` : ""}{co?.intitule ?? wc.coursId}</p>
                                <p className="text-[11px] text-muted-foreground">Capacité du cours : {courseCap} places</p>
                              </div>
                              <div>
                                {valide ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    ✓ Capacité validée ({wizardStudents.length} / {courseCap})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    ⚠️ Dépassement ({wizardStudents.length} &gt; {courseCap})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setCreationStep(3)} disabled={submitting}>← Précédent</Button>
                    <Button
                      onClick={handleFinalizeGroupCreation}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {submitting ? "Création en cours..." : "Valider et créer le groupe"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("groups.delete.title")}
        description={toDelete ? t("groups.delete.description", { name: toDelete.nom }) : undefined}
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Dialog : étudiants membres de la classe */}
      <Dialog open={membresOpen} onOpenChange={setMembresOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{membresTarget ? `Classe ${membresTarget.nom} — étudiants` : "Étudiants"}</DialogTitle>
          <DialogDescription>
            {t("groups.members.description", { count: membresTarget?.etudiants?.length ?? 0, capacity: membresTarget?.capacite ?? 0 })}
          </DialogDescription>

          {/* Formulaire d'inscription */}
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-2.5">
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 grid gap-1 text-xs font-medium">
                {t("groups.members.name")}
                <Input
                  value={membreNom}
                  placeholder="Ahlem Guesmi"
                  onChange={(e) => setMembreNom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAddMembre()}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                {t("groups.members.id")}
                <Input
                  value={membreId}
                  placeholder="22001"
                  inputMode="numeric"
                  onChange={(e) => setMembreId(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && void handleAddMembre()}
                />
              </label>
            </div>
            <Button size="sm" className="h-8 gap-1.5 self-start" onClick={handleAddMembre} disabled={membreAdding}>
              <UserPlus className="size-3.5" aria-hidden="true" />
              {t("groups.members.add")}
            </Button>
          </div>

          {/* Liste des membres */}
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {(membresTarget?.etudiants ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">{t("groups.members.empty")}</p>
            ) : (
              [...(membresTarget?.etudiants ?? [])]
                .sort((a, b) => a.nom.localeCompare(b.nom))
                .map((m) => (
                  <div key={m.etudiantId} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-extrabold text-indigo-800">
                        {m.nom
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="truncate text-xs font-semibold">{m.nom}</span>
                      <span className="shrink-0 font-mono text-2xs text-muted-foreground">#{m.etudiantId}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-red-700"
                      onClick={() => void handleRemoveMembre(m)}
                      disabled={membreRemoving === m.etudiantId}
                      title={t("groups.members.remove")}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog : affecter un cours à la classe (déroulants cours + type) */}
      <Dialog open={affectOpen} onOpenChange={setAffectOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("groups.affected.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("groups.affected.dialogDescription")}</DialogDescription>

          <div className="grid gap-3 py-2">
            <label className="grid gap-1 text-sm">
              {t("groups.affected.course")}
              <Select value={affectCoursId} onChange={(e) => setAffectCoursId(e.target.value)}>
                <option value="">—</option>
                {(courses.data ?? [])
                  .filter((c) => !(affectationsCible ?? []).some((a) => a.coursId === String(c.id)))
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code ? `${c.code} — ` : ""}
                      {c.intitule}
                    </option>
                  ))}
              </Select>
            </label>

            <label className="grid gap-1 text-sm">
              {t("groups.affected.typeLabel")}
              <Select value={affectKind} onChange={(e) => setAffectKind(e.target.value as SessionKind)}>
                <option value="CM">{KIND_LABEL.CM}</option>
                <option value="TD">{KIND_LABEL.TD}</option>
                <option value="TP">{KIND_LABEL.TP}</option>
              </Select>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAffectOpen(false)} disabled={affectSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAffectCours} disabled={affectSaving} className="bg-blue-600 text-white hover:bg-blue-700">
              {affectSaving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
