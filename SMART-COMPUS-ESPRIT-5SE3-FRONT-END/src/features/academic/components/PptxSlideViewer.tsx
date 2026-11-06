import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Download, Loader2, Presentation } from "lucide-react";
import { init } from "pptx-preview";
import JSZip from "jszip";
import { Button } from "@/shared/components/ui/button";
import { resolveDocumentUrl } from "../utils/fileStorage";
import type { ExternalResource } from "../types";

interface PptxSlideViewerProps {
  document: ExternalResource;
  onDownload: () => void;
}

/**
 * Normalise un PPTX : certains fichiers PowerPoint (comme ceux exportés d'anciennes
 * présentations) déclarent dans [Content_Types].xml des parts inexistantes
 * (ex. slideMaster2..N fantômes) ; pptx-preview plante dessus et rend 0 diapositive,
 * alors que PowerPoint les tolère. On purge ces déclarations avant le rendu.
 */
async function normaliserPptx(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const ct = zip.file("[Content_Types].xml");
    if (!ct) return buffer;

    const xml = await ct.async("string");
    const nettoie = xml.replace(/<Override\s+[^>]*PartName="\/([^"]+)"[^>]*>/g, (tag, part) => (zip.file(part) ? tag : ""));
    if (nettoie === xml) return buffer;

    zip.file("[Content_Types].xml", nettoie);
    return await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  } catch {
    return buffer;
  }
}

/**
 * Visionneuse PPTX réelle : télécharge le fichier support (URL serveur) et
 * le rend avec pptx-preview (toutes les diapositives, mise en page originale).
 */
export function PptxSlideViewer({ document, onDownload }: PptxSlideViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = viewerRef.current;
    let destroyed = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSlideCount(0);
      // Résout l'URL réellement exploitable : fichier local (IndexedDB), URL backend
      // normalisée, ou fallback /uploads/<nomFichier>.
      const url = await resolveDocumentUrl(document.fileName, document.url);
      if (!container || !url) {
        setError("Aucun fichier de présentation disponible.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Le fichier est inaccessible (${res.status}).`);
        const buffer = await normaliserPptx(await res.arrayBuffer());
        if (destroyed) return;
        container.replaceChildren();
        const previewer = init(container, {
          width: container.clientWidth || 960,
          mode: "list",
        });
        await previewer.preview(buffer);
        if (destroyed) {
          previewer.destroy();
          return;
        }
        setSlideCount(previewer.slideCount);
      } catch (e) {
        if (!destroyed) {
          console.error("Échec du rendu PPTX :", e);
          setError(e instanceof Error && e.message ? e.message : "Impossible d'afficher la présentation.");
        }
      } finally {
        if (!destroyed) setLoading(false);
      }
    }

    void load();

    return () => {
      destroyed = true;
      // pptx-preview ne fournit pas de handle : le conteneur est vidé au remontage.
      container?.replaceChildren();
    };
  }, [document.url, document.fileName]);

  return (
    <div className="rounded-2xl border border-amber-200/80 shadow-md bg-slate-950 text-white overflow-hidden">
      {/* Barre supérieure du lecteur */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30">
            <Presentation className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 truncate max-w-[280px]">{document.title || "Présentation PowerPoint"}</span>
              <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-2xs font-extrabold uppercase">
                Diaporama PPTX
              </span>
            </div>
            <p className="text-2xs text-slate-400">
              {slideCount > 0 ? (
                <>
                  <strong className="text-amber-400">{slideCount}</strong> diapositive(s)
                </>
              ) : (
                document.fileName || "Rendu fidèle du fichier original"
              )}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={onDownload}
          className="h-8 px-2.5 text-xs font-semibold border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
        >
          <Download className="mr-1.5 size-3.5 text-amber-400" />
          Télécharger (.pptx)
        </Button>
      </div>

      {/* Zone de rendu du fichier réel */}
      <div className="relative bg-slate-900 p-3 sm:p-4 min-h-[240px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-950/70 text-sm text-slate-300">
            <Loader2 className="size-4 animate-spin text-amber-400" />
            Chargement de la présentation…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/80 p-6 text-center">
            <AlertTriangle className="size-6 text-amber-400" />
            <p className="text-sm font-medium text-slate-200">{error}</p>
            <p className="text-2xs text-slate-400">Vous pouvez télécharger le fichier pour l'ouvrir dans PowerPoint.</p>
          </div>
        )}
        <div ref={viewerRef} className="pptx-viewer mx-auto max-w-full overflow-x-auto [&_div]:mx-auto" />
      </div>
    </div>
  );
}
