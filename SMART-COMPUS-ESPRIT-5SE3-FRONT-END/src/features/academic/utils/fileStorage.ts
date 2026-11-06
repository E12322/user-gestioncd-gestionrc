/**
 * Stockage persistant des fichiers volumineux (PDF de cours, supports, vidéos)
 * dans le navigateur via IndexedDB pour garantir l'accès après rafraîchissement
 * ou redémarrage du serveur, avec fallback direct sur /uploads/.
 */

const DB_NAME = "esprit_academic_files_db";
const STORE_NAME = "course_files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB non supporté"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Erreur ouverture IndexedDB"));
  });
}

/**
 * Sauvegarde un fichier ou Blob binaire dans IndexedDB
 */
export async function saveUploadedFile(fileName: string, file: Blob | File): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, fileName.toLowerCase());
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Échec sauvegarde fichier dans IndexedDB:", err);
  }
}

/**
 * Récupère un fichier ou Blob binaire depuis IndexedDB
 */
export async function getUploadedFile(fileName: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(fileName.toLowerCase());
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Cache local des Object URLs créés pour éviter les fuites mémoire
const activeObjectUrls = new Map<string, string>();

/**
 * Résout une URL exploitable pour un fichier PDF ou vidéo :
 * 1. Vérifie si le fichier original complet est dans IndexedDB -> crée et retourne un blob URL persistant
 * 2. Sinon, retourne l'URL publique /uploads/${fileName} ou le fallback fourni.
 */
export async function resolveDocumentUrl(fileName?: string, fallbackUrl?: string): Promise<string> {
  if (!fileName && fallbackUrl) return fallbackUrl;
  const name = fileName || "";

  if (activeObjectUrls.has(name.toLowerCase())) {
    return activeObjectUrls.get(name.toLowerCase())!;
  }

  if (name) {
    const storedBlob = await getUploadedFile(name);
    if (storedBlob && storedBlob.size > 0) {
      const blobUrl = URL.createObjectURL(storedBlob);
      activeObjectUrls.set(name.toLowerCase(), blobUrl);
      return blobUrl;
    }
  }

  if (fallbackUrl && !fallbackUrl.startsWith("blob:")) {
    return fallbackUrl;
  }

  const KNOWN_FILES = ["pfe book 1.pdf", "support_de_cours.pdf", "delice_holding_dd_rse-1.pptx", "delice.zip"];
  const isKnown = KNOWN_FILES.includes(name.toLowerCase());
  return isKnown ? `/uploads/${encodeURIComponent(name)}` : "/uploads/pfe%20book%201.pdf";
}
