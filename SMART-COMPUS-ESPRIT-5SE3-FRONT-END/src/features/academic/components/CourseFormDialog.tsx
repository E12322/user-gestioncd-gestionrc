import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { FileText, Upload, BookOpen, Trash2, Plus, ExternalLink, Layers, Globe } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { useViewer } from "../hooks";
import { USE_MOCKS } from "@/shared/api/client";
import { createCourse, updateCourse, uploadCourseFile, type CreateCoursePayload } from "../api";
import { DEPARTMENTS } from "../mocks";
import type { CourseView, ExternalResource } from "../types";
import { saveUploadedFile } from "../utils/fileStorage";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseToEdit?: CourseView | null;
  onSuccess: () => void;
}

interface DocumentItem extends ExternalResource {
  id: string;
}

export function CourseFormDialog({ open, onOpenChange, courseToEdit, onSuccess }: CourseFormDialogProps) {
  const viewer = useViewer();
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Informations de base
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0] || "Informatique");
  const [credits, setCredits] = useState("3");
  const [semester, setSemester] = useState<"S1" | "S2">("S1");
  const [teacherName, setTeacherName] = useState(viewer.name || "Karim Trabelsi");
  const [capacity, setCapacity] = useState("40");
  const [nature, setNature] = useState<"OBLIGATOIRE" | "OPTIONNEL">("OBLIGATOIRE");
  const [description, setDescription] = useState("");

  // Onglet actif : "info" | "content" | "resource"
  const [activeTab, setActiveTab] = useState<"info" | "content" | "resource">("info");

  // Contenu détaillé magistral
  const [content, setContent] = useState("");

  // Liste multiple de documents & supports
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  // Upload en cours vers le backend (mode réel)
  const [uploading, setUploading] = useState(false);

  // Formulaire d'ajout manuel de lien / ressource externe
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkFormat, setNewLinkFormat] = useState("PDF");

  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(courseToEdit);

  useEffect(() => {
    if (courseToEdit) {
      setCode(courseToEdit.code);
      setTitle(courseToEdit.title);
      setDepartment(courseToEdit.department);
      setCredits(String(courseToEdit.credits));
      setSemester((courseToEdit.semester as "S1" | "S2") || "S1");
      setTeacherName(courseToEdit.teacherName);
      setCapacity(String(courseToEdit.capacity));
      setDescription(courseToEdit.description || "");
      setContent(courseToEdit.content || "");

      // Initialiser la liste complète des documents
      const initialDocs: DocumentItem[] = [];
      if (courseToEdit.documents && Array.isArray(courseToEdit.documents) && courseToEdit.documents.length > 0) {
        courseToEdit.documents.forEach((d, idx) => {
          initialDocs.push({
            ...d,
            id: d.id || `doc-${idx}-${Date.now()}`,
          });
        });
      } else {
        // Rétrocompatibilité : extraire documentResource et videoResource
        if (courseToEdit.documentResource) {
          initialDocs.push({
            ...courseToEdit.documentResource,
            id: `doc-init-doc-${Date.now()}`,
            format: courseToEdit.documentResource.format || "PDF",
            type: "document",
          });
        }
        if (courseToEdit.videoResource) {
          initialDocs.push({
            ...courseToEdit.videoResource,
            id: `doc-init-vid-${Date.now()}`,
            format: "MP4",
            type: "video",
          });
        }
        if (
          courseToEdit.externalResource &&
          !initialDocs.some(
            (d) =>
              (d.fileName && d.fileName === courseToEdit.externalResource?.fileName) ||
              (d.url && d.url === courseToEdit.externalResource?.url),
          )
        ) {
          initialDocs.push({
            ...courseToEdit.externalResource,
            id: `doc-init-ext-${Date.now()}`,
          });
        }
      }
      setDocuments(initialDocs);
    } else {
      setCode("");
      setTitle("");
      setDepartment(DEPARTMENTS[0] || "Informatique");
      setCredits("3");
      setSemester("S1");
      setTeacherName(viewer.name || "Karim Trabelsi");
      setCapacity("40");
      setDescription("");
      setContent("");
      setDocuments([]);
    }
    setShowAddLinkForm(false);
    setActiveTab("info");
  }, [courseToEdit, open, viewer.name]);

  // Upload multiple de fichiers (PDF, Word, PPT, Vidéos, ZIP, etc.)
  // Upload multiple de fichiers (PDF, Word, PPT, Vidéos, ZIP, etc.)
  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const classify = (ext: string): { format: string; type: "file" | "url" | "video" | "document" } => {
      if (ext === "PDF") return { format: "PDF", type: "document" };
      if (ext === "PPT" || ext === "PPTX") return { format: "PPTX", type: "document" };
      if (ext === "DOC" || ext === "DOCX") return { format: "DOCX", type: "document" };
      if (ext === "XLS" || ext === "XLSX" || ext === "CSV") return { format: "XLSX", type: "file" };
      if (["ZIP", "RAR", "7Z", "TAR", "GZ"].includes(ext)) return { format: "ZIP", type: "file" };
      if (["MP4", "WEBM", "MKV", "AVI", "MOV"].includes(ext)) return { format: "MP4", type: "video" };
      return { format: ext || "FICHIER", type: "file" };
    };

    const newDocs: DocumentItem[] = [];

    // Mode réel : chaque fichier est envoyé au backend (stockage serveur persistant, servi sous /uploads/**).
    // Mode démo : sauvegarde IndexedDB locale avec une URL publique servie par Vite.
    if (!USE_MOCKS) {
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            const up = await uploadCourseFile(file);
            newDocs.push({
              id: `doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              title: (up.nomOriginal || file.name).replace(/\.[^/.]+$/, ""),
              fileName: up.nomFichier,
              fileSize: up.taille,
              format: up.format,
              type: classify((up.format || "").toUpperCase()).type,
              url: up.url,
            });
          } catch (err) {
            toast.error(`Échec de l'envoi de « ${file.name} » : ${err instanceof Error ? err.message : "erreur réseau"}`);
          }
        }
      } finally {
        setUploading(false);
      }
      if (newDocs.length === 0) {
        e.target.value = "";
        return;
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { format, type } = classify(file.name.split(".").pop()?.toUpperCase() || "");
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
        const publicUrl = `/uploads/${encodeURIComponent(file.name)}`;

        // Sauvegarde dans IndexedDB pour la persistance locale
        void saveUploadedFile(file.name, file);

        newDocs.push({
          id: `doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          fileSize: `${sizeInMb} Mo`,
          format,
          type,
          url: publicUrl,
        });
      }
    }

    setDocuments((prev) => [...prev, ...newDocs]);
    toast.success(`${newDocs.length} document(s) ajouté(s) avec succès !`);

    // Réinitialiser le champ de fichier
    e.target.value = "";
  };

  // Ajout manuel d'un lien (Google Drive, Vidéo en ligne, URL)
  const handleAddLinkDocument = () => {
    if (!newLinkUrl.trim()) {
      toast.error("Veuillez saisir une URL valide.");
      return;
    }

    const isVideo = newLinkFormat === "MP4" || newLinkUrl.includes("youtube.com") || newLinkUrl.includes("youtu.be");

    const doc: DocumentItem = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newLinkTitle.trim() || (isVideo ? "Vidéo en ligne" : "Lien externe"),
      url: newLinkUrl.trim(),
      format: newLinkFormat,
      type: isVideo ? "video" : newLinkFormat === "PDF" ? "document" : "url",
      fileSize: "Ressource Web",
    };

    setDocuments((prev) => [...prev, doc]);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setShowAddLinkForm(false);
    toast.success("Ressource ajoutée avec succès !");
  };

  // Suppression d'un document de la liste
  const handleRemoveDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.info("Document retiré");
  };

  // Mise à jour du titre d'un document
  const handleUpdateDocumentTitle = (id: string, newTitle: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d)));
  };

  // Génération IA supprimée — fonctionnalité non optimale

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      toast.error("Veuillez renseigner le code et l'intitulé du cours");
      return;
    }

    setLoading(true);

    const primaryDoc = documents.find((d) => d.format === "PDF" || d.type === "document") || documents[0];
    const primaryVideo = documents.find((d) => d.format === "MP4" || d.type === "video");

    const payload: CreateCoursePayload = {
      code: code.trim(),
      title: title.trim(),
      department,
      credits: Number(credits) || 3,
      semester,
      teacherName: teacherName.trim(),
      capacity: Number(capacity) || 40,
      description: description.trim(),
      content: content.trim() || undefined,
      documents: documents.map((d) => ({
        id: d.id,
        title: d.title,
        fileName: d.fileName,
        fileSize: d.fileSize,
        format: d.format,
        type: d.type,
        url: d.url,
      })),
      documentResource: primaryDoc,
      videoResource: primaryVideo,
      externalResource: primaryDoc || primaryVideo,
    };

    try {
      if (isEditing && courseToEdit) {
        await updateCourse(courseToEdit.id, payload, viewer);
        toast.success(`Le cours « ${payload.title} » et ses documents ont été mis à jour !`);
      } else {
        await createCourse(payload, viewer);
        toast.success(`Le cours « ${payload.title} » a été créé avec ses documents !`);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement du cours : " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Badge couleur selon format
  const getBadgeStyle = (format?: string) => {
    switch (format?.toUpperCase()) {
      case "PDF":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "PPT":
      case "PPTX":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "DOC":
      case "DOCX":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "MP4":
      case "VIDEO":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "ZIP":
      case "RAR":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "XLS":
      case "XLSX":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>{isEditing ? `Modifier le cours : ${courseToEdit?.code}` : "Ajouter un nouveau cours"}</DialogTitle>
        <DialogDescription>
          Renseignez les informations pédagogiques, le contenu magistral et joignez tous les documents (PDF, Word, PPT, Vidéos, etc.).
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Onglets de navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "info" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <BookOpen className="size-3.5" />
              1. Informations Générales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "content" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileText className="size-3.5" />
              2. Syllabus & Contenu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("resource")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "resource" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Upload className="size-3.5" />
              3. Documents & Supports ({documents.length})
            </button>
          </div>

          {/* ONGLET 1 : INFORMATIONS DE BASE */}
          {activeTab === "info" && (
            <div className="space-y-4 pt-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="course-code" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Code du Cours *
                  </label>
                  <Input
                    id="course-code"
                    required
                    placeholder="Ex: INF-301, GL-250..."
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-department"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Département *
                  </label>
                  <Select id="course-department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label htmlFor="course-title" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Intitulé officiel de la Matière *
                </label>
                <Input
                  id="course-title"
                  required
                  placeholder="Ex: Architecture des Microservices et Cloud Native"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="course-credits"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Crédits ECTS *
                  </label>
                  <Input
                    id="course-credits"
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-semester"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Semestre
                  </label>
                  <Select id="course-semester" value={semester} onChange={(e) => setSemester(e.target.value as "S1" | "S2")}>
                    <option value="S1">Semestre 1 (S1)</option>
                    <option value="S2">Semestre 2 (S2)</option>
                  </Select>
                </div>

                <div>
                  <label
                    htmlFor="course-capacity"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Capacité (étudiants) *
                  </label>
                  <Input
                    id="course-capacity"
                    type="number"
                    min="5"
                    max="200"
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    htmlFor="course-nature"
                    className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Régime du cours *
                  </label>
                  <Select
                    id="course-nature"
                    value={nature}
                    onChange={(e) => setNature(e.target.value as "OBLIGATOIRE" | "OPTIONNEL")}
                  >
                    <option value="OBLIGATOIRE">Obligatoire (affecté par groupe)</option>
                    <option value="OPTIONNEL">Optionnel (inscription libre)</option>
                  </Select>
                </div>
              </div>

              <div>
                <label htmlFor="course-teacher" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enseignant Responsable *
                </label>
                <Input
                  id="course-teacher"
                  required
                  placeholder="Nom complet de l'enseignant"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="course-description"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Résumé / Présentation du Cours
                </label>
                <textarea
                  id="course-description"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Objectif global de la formation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ONGLET 2 : CONTENU MAGISTRAL & CHAPITRES */}
          {activeTab === "content" && (
            <div className="space-y-4 pt-1">
              <div>
                <label htmlFor="course-content" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Syllabus complet, Chapitres et Contenu du Cours (Markdown)
                </label>
                <textarea
                  id="course-content"
                  rows={12}
                  className="w-full font-mono text-xs leading-relaxed rounded-md border border-input bg-background p-3 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="## OBJECTIFS PÉDAGOGIQUES :&#10;- Maîtriser l'architecture...&#10;&#10;### Chapitre 1 : Introduction..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ONGLET 3 : DOCUMENTS & SUPPORTS MULTIPLES */}
          {activeTab === "resource" && (
            <div className="space-y-5 pt-2">
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/40 via-card to-card p-4 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="size-4 text-indigo-600" />
                      Documents et Supports du Cours ({documents.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ajoutez tous les documents nécessaires : PDF, présentations PowerPoint, Word, archives ZIP, vidéos MP4 ou liens web.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Input caché d'upload multiple */}
                    <input
                      type="file"
                      ref={multiFileInputRef}
                      onChange={handleMultiFileUpload}
                      multiple
                      accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.mp4,.webm,.mkv,.txt,.png,.jpg"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      onClick={() => multiFileInputRef.current?.click()}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-xs"
                    >
                      <Upload className="mr-1.5 size-3.5" />
                      Téléverser des fichiers
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddLinkForm(!showAddLinkForm)}
                      className="text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Globe className="mr-1.5 size-3.5" />
                      {showAddLinkForm ? "Fermer lien" : "Ajouter un lien"}
                    </Button>
                  </div>
                </div>

                {/* Formulaire dépliable d'ajout de lien / ressource externe */}
                {showAddLinkForm && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-3 mt-2">
                    <p className="text-xs font-bold text-indigo-950">Ajouter un lien Web / Vidéo / Drive :</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <Input
                          placeholder="Titre de la ressource"
                          value={newLinkTitle}
                          onChange={(e) => setNewLinkTitle(e.target.value)}
                          className="text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Input
                          placeholder="https://drive.google.com/... ou https://youtube.com/..."
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          className="text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1 flex gap-2">
                        <Select value={newLinkFormat} onChange={(e) => setNewLinkFormat(e.target.value)} className="text-xs bg-white">
                          <option value="PDF">PDF</option>
                          <option value="PPTX">PowerPoint (PPTX)</option>
                          <option value="DOCX">Word (DOCX)</option>
                          <option value="MP4">Vidéo (MP4 / YouTube)</option>
                          <option value="ZIP">Archive ZIP</option>
                          <option value="WEB">Site / Drive</option>
                        </Select>
                        <Button
                          type="button"
                          onClick={handleAddLinkDocument}
                          className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Liste des documents attachés */}
                <div className="space-y-2 pt-2">
                  {documents.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <FileText className="mx-auto size-8 text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">Aucun document joint pour le moment</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Cliquez sur « Téléverser des fichiers » pour ajouter un ou plusieurs documents.
                      </p>
                    </div>
                  ) : (
                    documents.map((doc, idx) => (
                      <div
                        key={doc.id || idx}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-lg border shadow-xs hover:border-indigo-200 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`rounded-md px-2 py-0.5 text-2xs font-extrabold uppercase border ${getBadgeStyle(doc.format)}`}>
                            {doc.format || "DOC"}
                          </span>

                          <div className="min-w-0 flex-1">
                            <Input
                              value={doc.title}
                              onChange={(e) => handleUpdateDocumentTitle(doc.id, e.target.value)}
                              className="h-7 text-xs font-medium border-transparent hover:border-input focus:border-input px-1"
                              placeholder="Titre du document..."
                            />
                            <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5 px-1">
                              {doc.fileName && (
                                <span className="truncate max-w-[200px]" title={doc.fileName}>
                                  Fichier : <strong>{doc.fileName}</strong>
                                </span>
                              )}
                              {doc.fileSize && <span>• {doc.fileSize}</span>}
                              {doc.url && !doc.fileName && <span className="truncate max-w-[200px] text-indigo-600">{doc.url}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {doc.url && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              asChild
                              className="size-7 p-0 text-slate-500 hover:text-indigo-600"
                              title="Ouvrir le document"
                            >
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveDocument(doc.id)}
                            className="size-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Supprimer ce document"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading}
              className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold shadow-sm"
            >
              {loading
                ? "Enregistrement en cours..."
                : isEditing
                  ? `Enregistrer les modifications (${documents.length} doc${documents.length > 1 ? "s" : ""})`
                  : `Créer le cours (${documents.length} doc${documents.length > 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
