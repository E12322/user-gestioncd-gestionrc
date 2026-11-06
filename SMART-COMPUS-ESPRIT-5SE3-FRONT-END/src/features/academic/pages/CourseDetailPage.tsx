import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeft, FileText, Download, Printer, ExternalLink, BookOpen, FileCheck, Plus, Layers, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CapacityGauge } from "@/shared/components/common/CapacityGauge";
import { DataTable, type Column } from "@/shared/components/common/DataTable";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { StatusPill } from "@/shared/components/common/StatusPill";
import { useAuth } from "@/shared/auth/AuthContext";
import { useT } from "@/shared/i18n";

import { useEnroll } from "../components/useEnroll";
import { useCourse, useViewer } from "../hooks";
import { updateCourse, assignTeacher } from "../api";
import { CourseFormDialog } from "../components/CourseFormDialog";
import { PptxSlideViewer } from "../components/PptxSlideViewer";
import { DAY_LABELS, type Course, type Session, type ExternalResource } from "../types";
import { resolveDocumentUrl, getUploadedFile } from "../utils/fileStorage";
import { AiAcademicService } from "../services/aiAcademicService";

/** Convertit une URL YouTube (standard ou courte) en URL d'intégration iframe */
function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const matchWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (matchWatch?.[1]) {
    return `https://www.youtube.com/embed/${matchWatch[1]}`;
  }
  return null;
}

export default function CourseDetailPage() {
  const t = useT();
  const { id = "" } = useParams();
  const { role } = useAuth();
  const viewer = useViewer();
  const query = useCourse(id);
  const { enroll, pendingId, alert } = useEnroll(query.refetch);

  const [generatingAi, setGeneratingAi] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherId, setNewTeacherId] = useState("");

  // Gestion multi-documents
  const [editCourseDialogOpen, setEditCourseDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [resolvedDocUrl, setResolvedDocUrl] = useState<string>("");

  const columns: Column<Session>[] = [
    { key: "day", header: t("academic.col.day"), cell: (s) => DAY_LABELS[s.day], sortValue: (s) => s.day },
    { key: "time", header: t("academic.col.time"), cell: (s) => `${s.start}–${s.end}` },
    { key: "kind", header: t("academic.col.type"), cell: (s) => t(`academic.kind.${s.kind}`) },
    { key: "room", header: t("academic.col.room"), cell: (s) => s.room },
  ];

  // Extraire l'ensemble des documents du cours
  const allDocs = useMemo<ExternalResource[]>(() => {
    if (!query.data) return [];
    const list: ExternalResource[] = [];
    if (query.data.documents && Array.isArray(query.data.documents) && query.data.documents.length > 0) {
      list.push(...query.data.documents);
    } else {
      if (query.data.documentResource) list.push(query.data.documentResource);
      if (query.data.videoResource) list.push(query.data.videoResource);
      if (
        query.data.externalResource &&
        !list.some(
          (d) =>
            (d.fileName && d.fileName === query.data?.externalResource?.fileName) || (d.url && d.url === query.data?.externalResource?.url),
        )
      ) {
        list.push(query.data.externalResource);
      }
    }
    return list;
  }, [query.data]);

  // Document actif affiché dans le lecteur principal
  const activeDoc = useMemo<ExternalResource | null>(() => {
    if (!allDocs || allDocs.length === 0) return null;
    if (selectedDocId) {
      const found = allDocs.find((d) => (d.id && d.id === selectedDocId) || d.fileName === selectedDocId || d.title === selectedDocId);
      if (found) return found;
    }
    // Par défaut : premier document PDF ou premier document de la liste
    return allDocs.find((d) => d.format === "PDF" || d.type === "document") || allDocs[0];
  }, [allDocs, selectedDocId]);

  useEffect(() => {
    if (activeDoc) {
      void resolveDocumentUrl(activeDoc.fileName, activeDoc.url).then((url) => {
        setResolvedDocUrl(url);
      });
    } else {
      setResolvedDocUrl("");
    }
  }, [activeDoc]);

  const handleOpenDoc = async (doc: ExternalResource) => {
    const url = await resolveDocumentUrl(doc.fileName, doc.url);
    window.open(url, "_blank");
  };

  const handleDownloadDoc = async (doc: ExternalResource) => {
    const name = doc.fileName || `${doc.title}.${(doc.format || "pdf").toLowerCase()}`;
    if (doc.fileName) {
      const storedBlob = await getUploadedFile(doc.fileName);
      if (storedBlob) {
        const url = URL.createObjectURL(storedBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Téléchargement de « ${name} » démarré !`);
        return;
      }
    }

    const link = document.createElement("a");
    link.href = doc.url && !doc.url.startsWith("blob:") ? doc.url : `/uploads/${encodeURIComponent(name)}`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Téléchargement de « ${name} » démarré !`);
  };

  const handleGenerateCourseContent = async (courseTitle: string, courseCode: string) => {
    setGeneratingAi(true);
    try {
      const generated = await AiAcademicService.genererCoursComplet({
        matiere: courseTitle || courseCode,
        niveau: "Avancé (M2/Ingénieur)",
        nbExercices: 3,
      });

      let formattedText = `## OBJECTIFS PÉDAGOGIQUES :\n${generated.objectifs.map((o) => "- " + o).join("\n")}\n\n`;
      formattedText += `## SYLLABUS & CHAPITRES :\n\n`;
      generated.chapitres.forEach((c, idx) => {
        formattedText += `### Chapitre ${idx + 1} : ${c.titre} (${c.dureeEstimee})\n${c.contenu}\n\n`;
      });

      await updateCourse(
        id,
        {
          // Le backend exige l'intitulé (@NotBlank) : on renvoie les champs du cours
          // pour ne pas vider les autres colonnes lors de la mise à jour.
          code: query.data?.code,
          title: query.data?.title ?? courseTitle,
          department: query.data?.department,
          credits: query.data?.credits,
          semester: query.data?.semester,
          capacity: query.data?.capacity,
          content: formattedText,
        },
        viewer,
      );
      toast.success("Contenu magistral et chapitres générés avec succès !");
      void query.refetch();
    } catch (err) {
      toast.error("Erreur lors de la génération : " + (err as Error).message);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportTxt = (course: Course) => {
    const content = course.content || course.description;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Syllabus_${course.code}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Téléchargement du texte du cours (.txt)");
  };

  const getFormatBadgeStyle = (format?: string) => {
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
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link to="/academique">
          <ArrowLeft aria-hidden="true" />
          {t("academic.back")}
        </Link>
      </Button>
      {alert}

      <QueryBoundary query={query} moduleName={t("module.academic")} skeleton={<Skeleton className="h-72 w-full rounded-xl" />}>
        {(c) => {
          return (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 space-y-6">
                {/* Carte d'en-tête du Cours */}
                <Card>
                  <CardHeader className="items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">{c.code}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{c.department}</span>
                        <span className="text-xs text-muted-foreground">{c.semester}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{c.title}</h2>
                    </div>
                    {c.myEnrollment && <StatusPill status={c.myEnrollment} />}
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{c.description}</p>
                  </CardContent>
                </Card>

                {/* SECTION MULTI-DOCUMENTS & LECTEUR INTÉGRÉ */}
                {allDocs.length > 0 && (
                  <Card className="border-indigo-100 shadow-xs overflow-hidden">
                    <CardHeader className="flex-row items-center justify-between pb-3 bg-gradient-to-r from-indigo-50/60 via-card to-card">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-indigo-600 p-2 text-white">
                          <Layers className="size-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base text-foreground">Documents & Supports Pédagogiques</CardTitle>
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                              {allDocs.length} document{allDocs.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Consultez en direct ou téléchargez l'ensemble des supports de cours.
                          </p>
                        </div>
                      </div>

                      {role === "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditCourseDialogOpen(true)}
                          className="text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Plus className="mr-1.5 size-3.5" />
                          Ajouter d'autres documents
                        </Button>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4 pt-3">
                      {/* Sélecteur de document actif si plus d'un document */}
                      {allDocs.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100/70 rounded-lg border">
                          <span className="text-xs font-bold text-slate-600 px-2">Document affiché :</span>
                          {allDocs.map((doc, idx) => {
                            const isActive =
                              (activeDoc?.id && doc.id && activeDoc.id === doc.id) ||
                              activeDoc?.fileName === doc.fileName ||
                              activeDoc?.title === doc.title;
                            return (
                              <button
                                key={doc.id || idx}
                                type="button"
                                onClick={() => setSelectedDocId(doc.id || doc.fileName || doc.title)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                  isActive
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-200"
                                }`}
                              >
                                <span className="text-2xs uppercase opacity-80">{doc.format || "DOC"}</span>
                                <span className="truncate max-w-[150px]">{doc.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Visionneuse / Lecteur pour le document sélectionné */}
                      {activeDoc && (
                        <div className="space-y-3">
                          {/* SI PDF : Lecteur PDF interactif */}
                          {activeDoc.format === "PDF" || (!activeDoc.format && activeDoc.fileName?.toLowerCase().endsWith(".pdf")) ? (
                            <div className="space-y-3">
                              <div className="rounded-xl overflow-hidden border shadow-inner bg-slate-100">
                                <iframe
                                  src={
                                    resolvedDocUrl ||
                                    (activeDoc.url && !activeDoc.url.startsWith("blob:")
                                      ? activeDoc.url
                                      : `/uploads/${encodeURIComponent(activeDoc.fileName || "pfe book 1.pdf")}`)
                                  }
                                  className="w-full h-[600px] border-none"
                                  title={`Lecteur PDF - ${activeDoc.title}`}
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border">
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <FileCheck className="size-4 text-emerald-600" />
                                  <span>
                                    Support PDF : <strong className="text-foreground">{activeDoc.title}</strong>
                                    {activeDoc.fileName && <span className="ml-1 text-slate-500">({activeDoc.fileName})</span>}
                                    {activeDoc.fileSize && <span className="ml-1 font-semibold">• {activeDoc.fileSize}</span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenDoc(activeDoc)}
                                    className="bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold"
                                  >
                                    <ExternalLink className="mr-1.5 size-3.5" />
                                    Consulter en plein écran
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadDoc(activeDoc)}
                                    className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                                  >
                                    <Download className="mr-1.5 size-3.5" />
                                    Télécharger le PDF
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : activeDoc.format === "MP4" || activeDoc.type === "video" ? (
                            /* SI VIDÉO : Lecteur Vidéo HD */
                            <div className="space-y-3">
                              {getYouTubeEmbedUrl(activeDoc.url) ? (
                                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                                  <iframe
                                    src={getYouTubeEmbedUrl(activeDoc.url)!}
                                    className="w-full h-full border-none"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={activeDoc.title}
                                  />
                                </div>
                              ) : (
                                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                                  {/* Pas de piste de sous-titres disponible sur les vidéos uploadées par les enseignants. */}
                                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                  <video controls src={resolvedDocUrl || activeDoc.url} className="w-full h-full object-contain">
                                    Votre navigateur ne supporte pas la vidéo.
                                  </video>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border">
                                <span className="text-xs font-semibold text-slate-700">
                                  {activeDoc.title} {activeDoc.fileSize && `(${activeDoc.fileSize})`}
                                </span>
                                <div className="flex items-center gap-2">
                                  {activeDoc.fileName && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDownloadDoc(activeDoc)}
                                      className="text-xs font-semibold"
                                    >
                                      <Download className="mr-1.5 size-3.5" />
                                      Télécharger la vidéo (.mp4)
                                    </Button>
                                  )}
                                  {activeDoc.url && (
                                    <Button
                                      size="sm"
                                      asChild
                                      className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold"
                                    >
                                      <a href={activeDoc.url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-1.5 size-3.5" />
                                        Ouvrir en plein écran
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : activeDoc.format === "PPT" ||
                            activeDoc.format === "PPTX" ||
                            (!activeDoc.format && activeDoc.fileName?.toLowerCase().match(/\.pptx?$/)) ? (
                            /* SI DIAPORAMA POWERPOINT : Lecteur Diaporama Interactif */
                            <PptxSlideViewer document={activeDoc} onDownload={() => void handleDownloadDoc(activeDoc)} />
                          ) : (
                            /* AUTRE FICHIER (Word, Excel, ZIP) */
                            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold uppercase border ${getFormatBadgeStyle(
                                    activeDoc.format,
                                  )}`}
                                >
                                  {activeDoc.format || "FICHIER"}
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-foreground">{activeDoc.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {activeDoc.fileName} {activeDoc.fileSize && `• ${activeDoc.fileSize}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleDownloadDoc(activeDoc)}
                                  className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold"
                                >
                                  <Download className="mr-1.5 size-3.5" />
                                  Télécharger ce document
                                </Button>
                                {activeDoc.url && (
                                  <Button size="sm" variant="outline" asChild className="text-xs">
                                    <a href={activeDoc.url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-1.5 size-3.5" />
                                      Ouvrir
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Liste détaillée et interactive de tous les documents */}
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Tous les {allDocs.length} support(s) joints à ce cours :
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {allDocs.map((doc, idx) => (
                            <div
                              key={doc.id || idx}
                              className="flex items-center justify-between p-2.5 rounded-lg border bg-white shadow-2xs hover:border-indigo-200 transition-all text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-3xs font-extrabold uppercase border ${getFormatBadgeStyle(
                                    doc.format,
                                  )}`}
                                >
                                  {doc.format || "DOC"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-foreground truncate" title={doc.title}>
                                    {doc.title}
                                  </p>
                                  <p className="text-2xs text-muted-foreground truncate">
                                    {doc.fileName || doc.url || "Document"} {doc.fileSize && `(${doc.fileSize})`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedDocId(doc.id || doc.fileName || doc.title);
                                    if (doc.format === "PDF" || (!doc.format && doc.fileName?.endsWith(".pdf"))) {
                                      // Déjà dans le lecteur
                                    } else {
                                      void handleOpenDoc(doc);
                                    }
                                  }}
                                  className="size-7 p-0 text-indigo-600 hover:bg-indigo-50"
                                  title="Consulter"
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadDoc(doc)}
                                  className="size-7 p-0 text-slate-600 hover:bg-slate-100"
                                  title="Télécharger"
                                >
                                  <Download className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Si aucun document joint, bouton pour en ajouter */}
                {allDocs.length === 0 && role === "admin" && (
                  <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="text-center py-6 space-y-2">
                      <FileText className="size-8 mx-auto text-slate-400" />
                      <p className="text-xs font-semibold text-slate-600">Aucun document joint pour ce cours</p>
                      <Button
                        size="sm"
                        onClick={() => setEditCourseDialogOpen(true)}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold"
                      >
                        <Plus className="mr-1.5 size-3.5" />
                        Ajouter des documents de cours
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* SECTION 3 : CONTENU MAGISTRAL & SYLLABUS DÉTAILLÉ */}
                <Card>
                  <CardHeader className="flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-4 text-indigo-600" />
                      <CardTitle className="text-base">Syllabus & Contenu du Cours</CardTitle>
                    </div>

                    {c.content && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportTxt(c)}
                          title="Télécharger le texte"
                          className="text-xs"
                        >
                          <Download className="mr-1 size-3.5" />
                          Texte (.txt)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.print()}
                          title="Imprimer ou enregistrer en PDF"
                          className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <Printer className="mr-1 size-3.5" />
                          PDF
                        </Button>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent>
                    {c.content ? (
                      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800 bg-slate-50/60 p-4 rounded-xl border font-sans">
                        {c.content}
                      </div>
                    ) : (
                      <div className="py-6 text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Aucun contenu magistral détaillé n'a encore été saisi pour ce cours.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateCourseContent(c.title, c.code)}
                          disabled={generatingAi}
                          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
                        >
                          <Sparkles className="mr-1.5 size-3.5 text-indigo-600" />
                          {generatingAi ? "Génération du programme en cours..." : "Générer le syllabus et les chapitres par IA"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SECTION 4 : SÉANCES & EMPLOI DU TEMPS */}
                <section aria-labelledby="sessions-title">
                  <h2 id="sessions-title" className="mb-3 text-lg font-semibold">
                    {t("academic.detail.sessions")}
                  </h2>
                  <DataTable
                    caption={t("academic.detail.sessions")}
                    columns={columns}
                    data={c.sessions}
                    rowKey={(s) => s.id}
                    pageSize={10}
                    emptyTitle={t("academic.empty.sessions")}
                  />
                </section>
              </div>

              {/* Panneau latéral des informations */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("academic.detail.info")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t("academic.detail.teacher")}</dt>
                      <dd className="font-semibold text-foreground flex items-center justify-between">
                        <span>{c.teacherName}</span>
                        {role === "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                            onClick={() => {
                              setNewTeacherName(c.teacherName);
                              setNewTeacherId(c.teacherId.replace(/\D/g, "") || "1");
                              setAssigningTeacher(true);
                            }}
                          >
                            Modifier
                          </Button>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("academic.detail.credits")}</dt>
                      <dd className="font-semibold text-foreground">{c.credits} crédits ECTS</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Semestre</dt>
                      <dd className="font-semibold text-foreground">{c.semester}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Supports pédagogiques</dt>
                      <dd className="font-semibold text-foreground">
                        {allDocs.length > 0
                          ? `${allDocs.length} document${allDocs.length > 1 ? "s" : ""} joint${allDocs.length > 1 ? "s" : ""}`
                          : "Aucun support joint"}
                      </dd>
                    </div>
                  </dl>

                  <CapacityGauge used={c.enrolled} capacity={c.capacity} label={t("academic.course.seats")} />

                  {role === "admin" && (
                    <Button
                      variant="outline"
                      className="w-full text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => setEditCourseDialogOpen(true)}
                    >
                      <Layers className="mr-1.5 size-3.5" />
                      Gérer tous les documents ({allDocs.length})
                    </Button>
                  )}

                  {role === "student" && (!c.myEnrollment || c.myEnrollment === "refused") && (
                    <Button
                      className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
                      disabled={pendingId === c.id}
                      onClick={() => void enroll(c)}
                    >
                      {c.enrolled >= c.capacity
                        ? t("academic.enroll.full")
                        : c.myEnrollment === "refused"
                          ? t("academic.enroll.retry")
                          : t("academic.enroll")}
                    </Button>
                  )}

                  {role === "student" && c.myEnrollment === "pending" && (
                    <EmptyState className="py-2" title={t("academic.enroll.pendingInfo")} />
                  )}
                </CardContent>
              </Card>
            </div>
          );
        }}
      </QueryBoundary>

      {/* Modal d'édition du cours et de gestion des documents */}
      {query.data && (
        <CourseFormDialog
          open={editCourseDialogOpen}
          onOpenChange={setEditCourseDialogOpen}
          courseToEdit={query.data}
          onSuccess={() => void query.refetch()}
        />
      )}

      {/* Modal d'affectation d'un enseignant (Admin) */}
      {assigningTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">Affecter un enseignant</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Met à jour l'enseignant responsable et synchronise avec PostgreSQL via l'API Spring Boot.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="assign-teacher-id" className="text-xs font-semibold text-muted-foreground">
                  ID Enseignant (numérique)
                </label>
                <input
                  id="assign-teacher-id"
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  placeholder="Ex: 1"
                />
              </div>
              <div>
                <label htmlFor="assign-teacher-name" className="text-xs font-semibold text-muted-foreground">
                  Nom complet
                </label>
                <input
                  id="assign-teacher-name"
                  type="text"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-background"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Ex: Karim Trabelsi"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAssigningTeacher(false)}>
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={async () => {
                  try {
                    await assignTeacher(id, `ENS-${newTeacherId}`, newTeacherName, viewer);
                    toast.success("Enseignant affecté avec succès !");
                    setAssigningTeacher(false);
                    void query.refetch();
                  } catch (e) {
                    toast.error("Erreur d'affectation : " + (e as Error).message);
                  }
                }}
              >
                Confirmer l'affectation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
