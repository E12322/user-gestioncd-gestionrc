import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck,
  RotateCcw,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/shared/auth/AuthContext";
import { isApiError } from "@/shared/api/errors";
import { useQuery } from "@/shared/api/useQuery";
import { ConflictAlert } from "@/shared/components/common/ConflictAlert";
import { ConfirmDialog } from "@/shared/components/common/ConfirmDialog";
import { QueryBoundary } from "@/shared/components/common/QueryBoundary";
import { createSession, deleteSession, getTimetable, listAcademicCourses, listGroups, listRooms } from "../api";
import { useViewer } from "../hooks";
import type { CoursBackendDTO } from "../api";
import type { SessionKind, SessionInput, TimetableEntry } from "../types";

/* ────────────────────────────────────────────────────────────────────────────
   Emploi du temps réel (backend /academic/v1/sessions) habillé exactement
   comme la planification démo : en-tête + badges, actions solveur, séances à
   placer, score Timefold, simulation « Et si ? », cycle de publication.
   ──────────────────────────────────────────────────────────────────────────── */

/** Type de séance affiché : CM réel → « COURS » comme la démo. */
type KindAffiche = "COURS" | "TD" | "TP";
const affiche = (kind: SessionKind): KindAffiche => (kind === "CM" ? "COURS" : (kind as KindAffiche));

const KIND_COLORS: Record<KindAffiche, { bg: string; text: string; border: string; dot: string }> = {
  COURS: { bg: "bg-blue-100/70 hover:bg-blue-100", text: "text-blue-900", border: "border-blue-200", dot: "bg-blue-500" },
  TD: { bg: "bg-emerald-100/70 hover:bg-emerald-100", text: "text-emerald-950", border: "border-emerald-200", dot: "bg-emerald-500" },
  TP: { bg: "bg-amber-100/70 hover:bg-amber-100", text: "text-amber-950", border: "border-amber-200", dot: "bg-amber-500" },
};

/** Créneaux hebdomadaires de la grille (mêmes bornes que la démo ; les séances réelles
 *  sont placées par chevauchement, des créneaux réels hors bornes sont ajoutés). */
const CRENEAUX_FIXES: { start: string; end: string }[] = [
  { start: "08:30", end: "10:00" },
  { start: "10:15", end: "11:45" },
  { start: "13:30", end: "15:00" },
  { start: "15:15", end: "16:45" },
];

/** Semaines affichées (comme la démo) ; les séances étant récurrentes, la semaine
 *  sélectionne la fenêtre d'affichage sans changer les données. */
const SEMAINES: { key: string; label: string; debut: string }[] = [
  { key: "S12", label: "S12 · 16–20 nov.", debut: "2026-11-16" },
  { key: "S13", label: "S13 · 23–27 nov.", debut: "2026-11-23" },
  { key: "S14", label: "S14 · 30 nov.–4 déc.", debut: "2026-11-30" },
];

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Colonnes de la semaine : lundi–vendredi (+ samedi si une séance réelle l'utilise). */
const joursDeLaSemaine = (debut: string, samedi: boolean) => {
  const base = new Date(`${debut}T00:00:00`);
  const nb = samedi ? 6 : 5;
  return Array.from({ length: nb }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      id: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
      label: JOURS_SEMAINE[i]!,
      dateNum: String(d.getDate()).padStart(2, "0"),
    };
  });
};

const sousTitreSemaine = (debut: string) => {
  const d = new Date(`${debut}T00:00:00`);
  const fin = new Date(d);
  fin.setDate(d.getDate() + 4);
  const mois = [
    "",
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const annee = d.getFullYear();
  return `Semestre 1 · Semaine du ${d.getDate()} au ${fin.getDate()} ${mois[fin.getMonth() + 1]} ${annee}`;
};

const chevauchent = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;

const dureeHeures = (start: string, end: string) => {
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  return Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
};

/** Typologie de salle déduite du nom (Amphi… / Labo… / salle TD). */
const typeDeSalle = (nom: string): "Amphi" | "Labo" | "Salle TD" =>
  nom.startsWith("Amphi") ? "Amphi" : nom.startsWith("Labo") ? "Labo" : "Salle TD";

/* ── Score de qualité (formules de la démo Timefold, généralisées aux créneaux réels) ── */
const calculerScore = (
  seances: { day: number; start: string; end: string }[],
  grille: { start: string; end: string }[],
  nbConflitsDurs: number,
) => {
  let trous = 0;
  let surcharges = 0;
  for (let d = 1; d <= 6; d++) {
    const duJour = seances.filter((s) => s.day === d);
    if (duJour.length === 0) continue;
    if (duJour.length >= 4) surcharges++;
    const indexes = duJour
      .map((s) => grille.findIndex((c) => chevauchent(s, c)))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    for (let i = 0; i < indexes.length - 1; i++) {
      const ecart = indexes[i + 1]! - indexes[i]!;
      if (ecart > 1) trous += ecart - 1;
    }
  }
  const hardScore = Math.max(0, 100 - nbConflitsDurs * 50);
  const softScore = Math.max(20, Math.min(100, 100 - (trous * 8 + surcharges * 10)));
  const totalScore = Math.round(hardScore * 0.6 + softScore * 0.4);
  return {
    totalScore,
    hardScore,
    softScore,
    breakdown: {
      trous,
      surcharges,
      prefsEnseignants: Math.min(100, 85 + (totalScore > 80 ? 10 : 0)),
    },
  };
};

/** Décalage de score d'un déplacement (mêmes deltas que la démo : +6 sur le 2ᵉ créneau). */
interface SimulationImpact {
  ancien: number;
  nouveau: number;
  delta: number;
  verdict: string;
  fromSlot: string;
  fromDay: string;
  toSlot: string;
  toDay: string;
}

const impactDeplacement = (scoreActuel: number, slotIndex: number, conflit: boolean) => {
  const delta = conflit ? -35 : slotIndex === 1 ? 6 : 2;
  const nouveauScore = Math.max(10, Math.min(100, scoreActuel + delta));
  return {
    ancien: scoreActuel,
    nouveau: nouveauScore,
    delta,
    verdict: conflit ? "Déconseillé (crée un trou)" : delta >= 4 ? "Fortement recommandé" : "Neutre",
  };
};

interface SeanceForm {
  coursId: string;
  salleId: string;
  groupeId: string;
  kind: SessionKind;
  day: string;
  start: string;
  end: string;
}

const EMPTY_FORM: SeanceForm = { coursId: "", salleId: "", groupeId: "", kind: "CM", day: "1", start: "08:30", end: "10:00" };

type ViewMode = "group" | "teacher" | "room";
type PublicationCycle = "brouillon" | "valide" | "publie";

export default function EmploiDuTempsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const isStudent = role === "student";
  const isTeacher = role === "teacher";

  const viewer = useViewer();
  const timetable = useQuery((signal) => getTimetable(viewer, signal), [viewer.id, viewer.role]);
  const rooms = useQuery((signal) => listRooms(signal), []);
  const groups = useQuery((signal) => listGroups(undefined, signal), []);
  const courses = useQuery((signal) => listAcademicCourses(signal), []);

  const [searchParams, setSearchParams] = useSearchParams();

  /* Vue active + sélections */
  const [viewMode, setViewMode] = useState<ViewMode>(isTeacher ? "teacher" : "group");
  const [selectedGroup, setSelectedGroup] = useState<string>(searchParams.get("group") ?? "");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [weekKey, setWeekKey] = useState<string>("S12");

  const entries = timetable.data ?? [];
  const week = SEMAINES.find((w) => w.key === weekKey) ?? SEMAINES[0]!;

  /* Sélection du groupe : ?group=<id> (arrivé depuis la carte Groupes) ou premier réel. */
  useEffect(() => {
    if (!selectedGroup && (groups.data?.length ?? 0) > 0) {
      const depuisUrl = searchParams.get("group");
      const cible = depuisUrl && (groups.data ?? []).some((g) => g.id === depuisUrl) ? depuisUrl : groups.data![0]!.id;
      setSelectedGroup(cible);
    }
  }, [groups.data, selectedGroup, searchParams]);

  /* Nom d'enseignant réel par cours (l'API séance transporte l'id ou nom). */
  const enseignantParCours = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of (courses.data ?? []) as CoursBackendDTO[]) {
      if (c.enseignantNom) {
        map.set(String(c.id), c.enseignantNom);
        map.set(String(c.id).replace(/\D/g, ""), c.enseignantNom);
      }
    }
    return map;
  }, [courses.data]);

  const nomEnseignant = (e: TimetableEntry) => {
    const cId = String(e.courseId ?? "");
    return (
      e.teacherName ||
      enseignantParCours.get(cId) ||
      enseignantParCours.get(cId.replace(/\D/g, "")) ||
      ""
    );
  };

  /* Conflit d'enseignant : priorité à l'id réel, sinon le nom (dérivé du cours). */
  const memeEnseignant = (a: { teacherId?: string | null; teacher?: string }, b: { teacherId?: string | null; teacher?: string }) =>
    (a.teacherId && a.teacherId === b.teacherId) || (!!a.teacher && a.teacher === b.teacher);

  const matchTeacher = (sessTeacher: string, target: string) => {
    if (!target) return false;
    const a = sessTeacher.trim().toLowerCase();
    const b = target.trim().toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  };

  /* Toutes les séances (vue large) pour les vues enseignant / salle et les conflits. */
  const toutesSeances = useMemo(
    () =>
      entries.map((e) => ({
        id: e.id,
        kindReel: e.kind,
        coursId: e.courseId,
        title: e.courseTitle,
        teacher: nomEnseignant(e),
        teacherId: e.teacherId,
        room: e.room,
        day: e.day,
        start: e.start,
        end: e.end,
        group: e.groupName ?? undefined,
        groupId: e.groupId ? String(e.groupId) : undefined,
      })),
    [entries, enseignantParCours],
  );

  /* Détection de la classe de l'étudiant connecté */
  const studentGroup = useMemo(() => {
    if (!isStudent) return null;
    const list = groups.data ?? [];
    const found = list.find((g) =>
      g.etudiants?.some(
        (et) =>
          String(et.etudiantId) === String(viewer.id) ||
          (viewer.name && et.nom.toLowerCase().includes(viewer.name.toLowerCase())),
      ),
    );
    return found ?? list[0] ?? null;
  }, [isStudent, groups.data, viewer.id, viewer.name]);

  useEffect(() => {
    if (isStudent && studentGroup && selectedGroup !== studentGroup.id) {
      setSelectedGroup(studentGroup.id);
    }
  }, [isStudent, studentGroup, selectedGroup]);

  /* Groupe cible actif */
  const groupeCible = useMemo(() => (groups.data ?? []).find((g) => g.id === selectedGroup) ?? null, [groups.data, selectedGroup]);

  /* Options des sélecteurs, dérivées des données réelles et des cours. */
  const teacherNames = useMemo(() => {
    const fromCourses = ((courses.data ?? []) as CoursBackendDTO[]).map((c) => c.enseignantNom).filter(Boolean) as string[];
    const fromSeances = toutesSeances.map((s) => s.teacher).filter(Boolean);
    const set = new Set<string>([...fromCourses, ...fromSeances]);
    if (user?.name && (isTeacher || isAdmin)) set.add(user.name);
    return [...set].sort();
  }, [courses.data, toutesSeances, user?.name, isTeacher, isAdmin]);

  /* Sélection enseignant automatique pour un enseignant connecté */
  useEffect(() => {
    if (isTeacher) {
      if (user?.name && selectedTeacher !== user.name) {
        setSelectedTeacher(user.name);
      }
    } else if (!selectedTeacher && teacherNames.length > 0) {
      setSelectedTeacher(teacherNames[0]!);
    }
  }, [isTeacher, user?.name, teacherNames, selectedTeacher]);

  const roomNames = useMemo(
    () => [...new Set([...(rooms.data?.map((r) => r.nom) ?? []), ...toutesSeances.map((s) => s.room)])].sort(),
    [rooms.data, toutesSeances],
  );

  /* ── Séances projetées sur la grille (modèle de la démo) ── */
  const scheduled = useMemo(
    () =>
      entries
        .filter((e) => {
          if (viewMode === "room") return !!selectedRoom && e.room === selectedRoom;
          if (viewMode === "teacher") {
            const target = isTeacher ? (user?.name || selectedTeacher) : selectedTeacher;
            return matchTeacher(nomEnseignant(e), target);
          }
          if (viewMode === "group") {
            const targetGrpId = isStudent ? (studentGroup?.id ?? selectedGroup) : selectedGroup;
            if (!targetGrpId) return true;
            return (
              String(e.groupId ?? "") === String(targetGrpId) ||
              (groupeCible && e.groupName === groupeCible.nom) ||
              (!e.groupId && e.kind === "CM")
            );
          }
          return true;
        })
        .map((e) => ({
          id: e.id,
          kind: affiche(e.kind),
          kindReel: e.kind,
          title: e.courseTitle,
          coursId: e.courseId,
          teacher: nomEnseignant(e),
          room: e.room,
          day: e.day,
          start: e.start,
          end: e.end,
          group: e.groupName ?? undefined,
          groupId: e.groupId ? String(e.groupId) : undefined,
        })),
    [entries, viewMode, selectedGroup, selectedTeacher, selectedRoom, enseignantParCours, isStudent, studentGroup, groupeCible, user?.name, isTeacher],
  );

  /* Créneaux : les 4 fixes de la démo + tout créneau réel hors bornes (sécurité). */
  const creneaux = useMemo(() => {
    const liste = [...CRENEAUX_FIXES];
    const ajoute = (start: string, end: string) => {
      if (!liste.some((c) => c.start === start && c.end === end) && !liste.some((c) => chevauchent(c, { start, end }))) {
        liste.push({ start, end });
      }
    };
    for (const s of scheduled) ajoute(s.start, s.end);
    return liste.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  }, [scheduled]);

  const samediUtilise = useMemo(() => scheduled.some((s) => s.day === 6), [scheduled]);
  const jours = useMemo(() => joursDeLaSemaine(week.debut, samediUtilise), [week.debut, samediUtilise]);
  const indexCreneau = (start: string) => creneaux.findIndex((c) => c.start === start);

  /* Conflits durs réels : chevauchements mondel sans backend (enseignant, salle ou classe). */
  const conflits = useMemo(() => {
    const resultat: { day: number; start: string; end: string; reason: string }[] = [];
    const cle = new Set<string>();
    for (let i = 0; i < toutesSeances.length; i++) {
      for (let j = i + 1; j < toutesSeances.length; j++) {
        const a = toutesSeances[i]!;
        const b = toutesSeances[j]!;
        if (a.day !== b.day || !chevauchent(a, b)) continue;
        const memeProf = memeEnseignant(a, b);
        const memeSalle = a.room === b.room;
        const memeGroupe = a.groupId && a.groupId === b.groupId;
        if (!memeProf && !memeSalle && !memeGroupe) continue;
        if (viewMode === "group" && a.groupId !== selectedGroup && b.groupId !== selectedGroup) continue;
        const reason = memeProf
          ? `${a.teacher || "L'enseignant"} déjà en cours sur ce créneau`
          : memeSalle
            ? `Salle ${a.room} déjà occupée`
            : `Classe ${a.group} déjà en cours`;
        for (const s of [a, b]) {
          for (const c of creneaux) {
            if (chevauchent(s, c)) {
              const k = `${s.day}|${c.start}`;
              if (!cle.has(k)) {
                cle.add(k);
                resultat.push({ day: s.day as number, start: c.start, end: c.end, reason });
              }
            }
          }
        }
      }
    }
    return resultat;
  }, [toutesSeances, viewMode, selectedGroup, creneaux]);

  /* Séances affichées dans une cellule jour × créneau. */
  const dansCellule = (day: number, slot: { start: string; end: string }) => scheduled.filter((s) => s.day === day && chevauchent(s, slot));

  /* ── Séances à placer : cours affectés à la classe sans séance planifiée ── */
  const unplaced = useMemo(() => {
    if (!groupeCible || viewMode !== "group" || !isAdmin) return [];
    return (groupeCible.affectations ?? [])
      .filter((a) => !scheduled.some((s) => s.coursId === a.coursId && s.groupId === selectedGroup))
      .map((a) => ({
        id: `u-${groupeCible.id}-${a.coursId}`,
        coursId: a.coursId,
        kind: affiche(a.kind),
        kindReel: a.kind,
        title: a.coursIntitule,
        teacher: a.enseignantNom || "",
        room: "",
        duration: "1 h 30",
        group: groupeCible.nom,
      }));
  }, [groupeCible, scheduled, viewMode, isAdmin, selectedGroup]);

  /* ── Clés localStorage (comme la démo) ── */
  const storagePubKey = `smartcampus_pub_${selectedGroup}_${weekKey}`;
  const [publicationCycle, setPublicationCycle] = useState<PublicationCycle>("brouillon");
  const [versionNumber, setVersionNumber] = useState(3);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storagePubKey);
      if (saved) {
        const p = JSON.parse(saved) as { cycle: PublicationCycle; version: number };
        setPublicationCycle(p.cycle);
        setVersionNumber(p.version);
      } else {
        setPublicationCycle("brouillon");
        setVersionNumber(3);
      }
    } catch {
      setPublicationCycle("brouillon");
      setVersionNumber(3);
    }
  }, [storagePubKey]);

  const sauvegarderCycle = (cycle: PublicationCycle, version: number) => {
    setPublicationCycle(cycle);
    setVersionNumber(version);
    try {
      localStorage.setItem(storagePubKey, JSON.stringify({ cycle, version }));
    } catch {
      /* ignore */
    }
  };

  /* ── Score de qualité (bouton + carte solveur) ── */
  const score = useMemo(
    () => calculerScore(viewMode === "group" ? scheduled : toutesSeances, creneaux, conflits.length),
    [scheduled, toutesSeances, creneaux, conflits, viewMode],
  );
  const [qualityModalOpen, setQualityModalOpen] = useState(false);

  const chargeHeures = useMemo(
    () => (viewMode === "group" ? scheduled : toutesSeances).reduce((total, s) => total + dureeHeures(s.start, s.end), 0),
    [scheduled, toutesSeances, viewMode],
  );
  const maxHeures = 24;

  /* ── Replanification d'imprévu (3 créneaux de rattrapage) ── */
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [unforeseenReason, setUnforeseenReason] = useState<"teacher_absent" | "room_unavailable">("teacher_absent");
  const [selectedSessionToRescheduleId, setSelectedSessionToRescheduleId] = useState<string>("");

  const rescheduleOptions = useMemo(() => {
    if (!selectedSessionToRescheduleId || viewMode !== "group") return [];
    const sess = scheduled.find((s) => s.id === selectedSessionToRescheduleId);
    if (!sess) return [];
    const options: {
      id: string;
      dayId: number;
      dayLabel: string;
      dateNum: string;
      slotLabel: string;
      start: string;
      end: string;
      room: string;
      delta: number;
      qualite: "Optimale" | "Très bonne";
      explication: string;
    }[] = [];
    for (const day of jours) {
      for (const c of creneaux) {
        if (sess.day === day.id && chevauchent(sess, c)) continue;
        const occupee = scheduled.some((s) => s.day === day.id && chevauchent(s, c));
        if (occupee) continue;
        let room = sess.room;
        if (sess.kind === "COURS" && !room.startsWith("Amphi")) {
          room = roomNames.find((r) => r.startsWith("Amphi")) ?? room;
        }
        if (sess.kind === "TP" && !room.startsWith("Labo")) {
          room = roomNames.find((r) => r.startsWith("Labo")) ?? room;
        }
        const memeJour = scheduled.filter((s) => s.day === day.id).length;
        const ideal = memeJour >= 1 && memeJour <= 2;
        options.push({
          id: `opt-${day.id}-${c.start}`,
          dayId: day.id,
          dayLabel: day.label,
          dateNum: day.dateNum,
          slotLabel: `${c.start}–${c.end}`,
          start: c.start,
          end: c.end,
          room,
          delta: ideal ? 4 : 2,
          qualite: ideal ? "Optimale" : "Très bonne",
          explication: ideal
            ? "Maintient un rythme pédagogique équilibré sans trou majeur"
            : "Créneau garanti sans aucun conflit d'enseignant ni de salle",
        });
      }
    }
    options.sort((a, b) => b.delta - a.delta);
    return options.slice(0, 3);
  }, [selectedSessionToRescheduleId, scheduled, jours, creneaux, viewMode, roomNames]);

  /** Applique une replanification : crée la nouvelle séance puis retire l'ancienne. */
  const handleApplyReschedule = async (opt: (typeof rescheduleOptions)[number]) => {
    const sess = scheduled.find((s) => s.id === selectedSessionToRescheduleId);
    if (!sess) return;
    const salle = (rooms.data ?? []).find((r) => r.nom === opt.room);
    if (!salle) {
      toast.error(`Salle « ${opt.room} » introuvable dans le référentiel.`);
      return;
    }
    const input: SessionInput = {
      coursId: sess.coursId,
      salleId: String(salle.id),
      ...(sess.groupId ? { groupeId: sess.groupId } : {}),
      kind: sess.kindReel,
      day: opt.dayId as SessionInput["day"],
      start: opt.start,
      end: opt.end,
    };
    try {
      await createSession(input);
      await deleteSession(sess.id);
      timetable.refetch();
      setRescheduleModalOpen(false);
      setSelectedSessionToRescheduleId("");
      toast.success(`Séance « ${sess.title} » replanifiée avec succès le ${opt.dayLabel} à ${opt.slotLabel} (${opt.room}) !`);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "La replanification a échoué (conflit ?).");
    }
  };

  /* ── Suggestion intelligente de salles libres ── */
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [targetSessionForRoom, setTargetSessionForRoom] = useState<(typeof scheduled)[number] | null>(null);

  const smartRoomSuggestions = useMemo(() => {
    if (!targetSessionForRoom) return [];
    const occupees = toutesSeances
      .filter((s) => s.day === targetSessionForRoom.day && chevauchent(s, targetSessionForRoom) && s.id !== targetSessionForRoom.id)
      .map((s) => s.room);
    const occupeSet = new Set(occupees);
    return (rooms.data ?? [])
      .map((r) => {
        const type = typeDeSalle(r.nom);
        const dispo = !occupeSet.has(r.nom) || r.nom === targetSessionForRoom.room;
        let scoreSalle = 70;
        let recommandee = false;
        let raison = "Salle standard utilisable";
        if (targetSessionForRoom.kind === "COURS") {
          if (type === "Amphi") {
            recommandee = true;
            scoreSalle = 98;
            raison = "Idéale : Grande capacité pour cours magistral";
          } else {
            scoreSalle = 40;
            raison = "Capacité limitée pour un cours entier";
          }
        } else if (targetSessionForRoom.kind === "TP") {
          if (type === "Labo") {
            recommandee = true;
            scoreSalle = 96;
            raison = "Équipée : Postes de travail et environnement technique";
          } else {
            scoreSalle = 30;
            raison = "Inadaptée : Pas de machines informatiques";
          }
        } else if (targetSessionForRoom.kind === "TD") {
          if (type === "Salle TD") {
            recommandee = true;
            scoreSalle = 95;
            raison = "Format optimal : Travaux dirigés en demi-groupe";
          } else if (type === "Amphi") {
            scoreSalle = 50;
            raison = "Trop spacieuse pour un TD";
          }
        }
        if (!dispo) {
          scoreSalle = 0;
          raison = "Occupée sur ce créneau par un autre groupe";
        }
        return { nom: r.nom, capacite: r.capacite ?? null, dispo, recommandee: recommandee && dispo, scoreSalle, raison };
      })
      .sort((a, b) => b.scoreSalle - a.scoreSalle);
  }, [targetSessionForRoom, toutesSeances, rooms.data]);

  /** Change la salle : crée la séance déplacée puis supprime l'ancienne. */
  const handleApplyRoom = async (nomSalle: string) => {
    if (!targetSessionForRoom || targetSessionForRoom.room === nomSalle) {
      setRoomModalOpen(false);
      return;
    }
    const salle = (rooms.data ?? []).find((r) => r.nom === nomSalle);
    if (!salle) {
      toast.error(`Salle « ${nomSalle} » introuvable.`);
      return;
    }
    const input: SessionInput = {
      coursId: targetSessionForRoom.coursId,
      salleId: String(salle.id),
      ...(targetSessionForRoom.groupId ? { groupeId: targetSessionForRoom.groupId } : {}),
      kind: targetSessionForRoom.kindReel,
      day: targetSessionForRoom.day as SessionInput["day"],
      start: targetSessionForRoom.start,
      end: targetSessionForRoom.end,
    };
    try {
      await createSession(input);
      await deleteSession(targetSessionForRoom.id);
      timetable.refetch();
      setRoomModalOpen(false);
      setTargetSessionForRoom(null);
      toast.success(`Salle « ${nomSalle} » assignée à la séance !`);
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "Le changement de salle a échoué (conflit ?).");
    }
  };

  /* ── Mode simulation (« Et si ? ») : teste un placement sans écrire en base ── */
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationImpact, setSimulationImpact] = useState<SimulationImpact | null>(null);

  /* ── Placement d'une séance à placer : dialog de création prérempli ── */
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<{ day: number; start: string; end: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SeanceForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const liveConflict = useMemo(() => {
    if (!form.salleId || !form.day || !form.start || !form.end) return null;
    const salle = (rooms.data ?? []).find((r) => r.id === form.salleId);
    const salleNom = salle?.nom;
    const dayNum = Number(form.day);
    const creneau = { start: form.start, end: form.end };

    const roomConflict = toutesSeances.find(
      (s) => s.room === salleNom && s.day === dayNum && chevauchent(s, creneau),
    );
    if (roomConflict) {
      return `La salle ${salleNom} est déjà occupée le ${JOURS_SEMAINE[dayNum - 1]} de ${roomConflict.start} à ${roomConflict.end} (cours « ${roomConflict.title} »).`;
    }

    if (form.groupeId) {
      const groupConflict = toutesSeances.find(
        (s) => s.groupId === form.groupeId && s.day === dayNum && chevauchent(s, creneau),
      );
      if (groupConflict) {
        return `Le groupe est déjà en cours le ${JOURS_SEMAINE[dayNum - 1]} de ${groupConflict.start} à ${groupConflict.end} (cours « ${groupConflict.title} »).`;
      }
    }

    return null;
  }, [form.salleId, form.day, form.start, form.end, form.groupeId, rooms.data, toutesSeances]);

  /* Suppression (confirmation pour protéger les données réelles) */
  const [toDelete, setToDelete] = useState<(typeof scheduled)[number] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groupesDuCours = useMemo(
    () =>
      (groups.data ?? []).filter(
        (g) => !form.coursId || g.coursId === form.coursId || (g.affectations ?? []).some((a) => a.coursId === form.coursId),
      ),
    [groups.data, form.coursId],
  );

  /** Première salle libre et adaptée au type, pour préremplir le dialog. */
  const salleSuggeree = (kind: KindAffiche, day: number, slot: { start: string; end: string }) => {
    const occupeSet = new Set(toutesSeances.filter((s) => s.day === day && chevauchent(s, slot)).map((s) => s.room));
    const prefere = kind === "COURS" ? "Amphi" : kind === "TP" ? "Labo" : "";
    const parType = prefere ? (rooms.data ?? []).filter((r) => r.nom.startsWith(prefere)) : (rooms.data ?? []);
    const reste = prefere ? (rooms.data ?? []).filter((r) => !r.nom.startsWith(prefere)) : [];
    for (const r of [...parType, ...reste]) {
      if (!occupeSet.has(r.nom)) return String(r.id);
    }
    return "";
  };

  /** Placement d'une séance « à placer » (glisser-déposer ou clic puis clic). */
  const handlePlaceSession = (item: (typeof unplaced)[number], day: number, slot: { start: string; end: string }) => {
    if (!isAdmin) return;
    const conflitCell = conflits.find((c) => c.day === day && c.start === slot.start);
    if (simulationActive) {
      const dayObj = jours.find((d) => d.id === day);
      const jourObj: { start: string; end: string } = { start: slot.start, end: slot.end };
      const impact = impactDeplacement(
        score.totalScore,
        indexCreneau(slot.start),
        Boolean(conflitCell) || scheduled.some((s) => s.day === day && chevauchent(s, jourObj)),
      );
      setSimulationImpact({
        ...impact,
        fromSlot: "Liste à placer",
        fromDay: "",
        toSlot: `${slot.start}–${slot.end}`,
        toDay: dayObj?.label ?? "",
      });
      toast.info("Impact de la simulation calculé en direct.");
      return;
    }
    setForm({
      coursId: item.coursId,
      salleId: salleSuggeree(item.kind, day, slot),
      groupeId: selectedGroup,
      kind: item.kindReel,
      day: String(day),
      start: slot.start,
      end: slot.end,
    });
    setConflict(null);
    setCreateOpen(true);
    setActiveDraggingId(null);
    setHighlightTarget(null);
  };

  const openCreate = (prefill?: Partial<SeanceForm>) => {
    const initialGroup = viewMode === "group" && selectedGroup ? selectedGroup : (groups.data?.[0]?.id ?? "");
    setForm({
      ...EMPTY_FORM,
      ...(viewMode === "room" && selectedRoom ? { salleId: String(rooms.data?.find((r) => r.nom === selectedRoom)?.id ?? "") } : {}),
      groupeId: initialGroup,
      ...prefill,
    });
    setConflict(null);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.coursId || !form.salleId || !form.start || !form.end) {
      toast.error("Le cours, la salle et les horaires sont obligatoires.");
      return;
    }
    if (form.start >= form.end) {
      toast.error("L'heure de fin doit être après l'heure de début.");
      return;
    }
    setSubmitting(true);
    setConflict(null);
    try {
      const input: SessionInput = {
        coursId: form.coursId,
        salleId: form.salleId,
        ...(form.groupeId ? { groupeId: form.groupeId } : {}),
        kind: form.kind,
        day: Number(form.day) as SessionInput["day"],
        start: form.start,
        end: form.end,
      };
      await createSession(input);
      toast.success("Séance planifiée.");
      setCreateOpen(false);
      timetable.refetch();
    } catch (e) {
      if (isApiError(e) && e.isConflict) {
        setConflict(e.message);
      } else {
        toast.error(isApiError(e) ? e.message : "Une erreur est survenue.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** Retire une séance de la grille (suppression réelle ; elle redevient « à placer »). */
  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteSession(toDelete.id);
      toast.info(`Séance « ${toDelete.title} » replacée dans la liste à placer.`);
      setToDelete(null);
      timetable.refetch();
    } catch (e) {
      toast.error(isApiError(e) ? e.message : "Une erreur est survenue.");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Génération automatique : place tous les cours non planifiés sans conflit ── */
  const [autoGenerating, setAutoGenerating] = useState(false);
  const handleAutoGenerate = async () => {
    if (!isAdmin) return;
    if (unplaced.length === 0) {
      toast.info("Tous les cours de cette classe sont déjà répartis de façon optimale !");
      return;
    }
    setAutoGenerating(true);
    const libres: { day: number; slot: { start: string; end: string } }[] = [];
    for (const day of jours) {
      for (const c of creneaux) {
        const secupee = scheduled.some((s) => s.day === day.id && chevauchent(s, c));
        const conflitCell = conflits.some((k) => k.day === day.id && k.start === c.start);
        if (!secupee && !conflitCell) libres.push({ day: day.id, slot: c });
      }
    }
    let placees = 0;
    const restantes: typeof unplaced = [];
    const occupeGroupes = new Set<string>();
    for (const item of unplaced) {
      let ok = false;
      const tentatives = [...libres];
      for (const libre of tentatives) {
        const salleId = salleSuggeree(item.kind, libre.day, libre.slot);
        if (!salleId) continue;
        const salle = (rooms.data ?? []).find((r) => String(r.id) === salleId);
        if (!salle) continue;
        try {
          await createSession({
            coursId: item.coursId,
            salleId,
            groupeId: selectedGroup,
            kind: item.kindReel,
            day: libre.day as SessionInput["day"],
            start: libre.slot.start,
            end: libre.slot.end,
          });
          placees++;
          occupeGroupes.add(`${libre.day}|${libre.slot.start}`);
          ok = true;
          break;
        } catch {
          // 409 : essai du créneau / salle suivant (le conflit réel vient du backend).
        }
      }
      if (!ok) restantes.push(item);
    }
    timetable.refetch();
    setAutoGenerating(false);
    if (placees > 0) {
      const version = versionNumber + 1;
      sauvegarderCycle(publicationCycle, version);
      toast.success(`Planification Timefold optimale : ${placees} séance(s) placée(s) automatiquement avec score ${score.totalScore}/100.`);
    }
    if (restantes.length > 0) {
      toast.warning(`${restantes.length} cours n'ont pas pu être placé(s) sans conflit : placez-les manuellement.`);
    }
  };

  /* ── Cycle de publication (localStorage, comme la démo) ── */
  const handleValidateDraft = () => {
    if (!isAdmin) return;
    sauvegarderCycle("valide", versionNumber);
    toast.success(`Brouillon validé pour le groupe ${groupeCible?.nom ?? selectedGroup}.`);
  };

  const handlePublish = () => {
    if (!isAdmin) return;
    sauvegarderCycle("publie", versionNumber);
    toast.success(`Emploi du temps officiel publié pour le groupe ${groupeCible?.nom ?? selectedGroup} (${week.label}) !`);
  };

  const handleResetToDefault = () => {
    if (!isAdmin) return;
    sauvegarderCycle("brouillon", 3);
    setSimulationImpact(null);
    toast.info(`Emploi du temps de ${groupeCible?.nom ?? selectedGroup} réinitialisé.`);
  };

  const handleGroupChange = (newGroup: string) => {
    setSelectedGroup(newGroup);
    setSearchParams({ group: newGroup }, { replace: true });
    toast.info(`Emploi du temps chargé : Groupe ${(groups.data ?? []).find((g) => g.id === newGroup)?.nom ?? newGroup} (${week.label})`);
  };

  const handleWeekChange = (newKey: string) => {
    setWeekKey(newKey);
    toast.info(`Semaine modifiée : ${SEMAINES.find((w) => w.key === newKey)?.label}`);
  };

  /* Titre de la page selon la vue et le rôle (exactement la démo). */
  const pageTitle = useMemo(() => {
    if (isStudent) return `Mon emploi du temps · Classe ${studentGroup?.nom ?? groupeCible?.nom ?? "Groupe 1"}`;
    if (viewMode === "group") return `Emploi du temps · Groupe ${groupeCible?.nom ?? selectedGroup}`;
    if (viewMode === "teacher") return `Emploi du temps · ${isTeacher ? (user?.name || selectedTeacher) : selectedTeacher}`;
    return `Emploi du temps · Salle ${selectedRoom}`;
  }, [isStudent, studentGroup, viewMode, groupeCible, selectedGroup, isTeacher, user?.name, selectedTeacher, selectedRoom]);

  const isGroupMode = viewMode === "group";

  return (
    <div className="space-y-4">
      {/* ─── BANDEAU DE SIMULATION EN COURS (« ET SI ? ») ─────────────────────── */}
      {isAdmin && simulationActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              <Sliders className="size-4" aria-hidden="true" />
            </span>
            <div>
              <span className="block text-xs font-bold text-amber-900">Mode Simulation (« Et si ? ») actif</span>
              <span className="text-3xs text-amber-700">
                Vous pouvez tester des déplacements de séances sans modifier l'emploi du temps officiel.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {simulationImpact && (
              <div className="rounded-md border border-amber-200 bg-white/80 px-2.5 py-1 text-xs font-bold text-amber-900">
                Score : {simulationImpact.ancien} → {simulationImpact.nouveau} ({simulationImpact.delta > 0 ? "+" : ""}
                {simulationImpact.delta} pts) · {simulationImpact.verdict}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSimulationActive(false);
                setSimulationImpact(null);
                toast.info("Mode simulation désactivé.");
              }}
              className="h-8 bg-white text-xs text-slate-800"
            >
              Quitter la simulation
            </Button>
          </div>
        </div>
      )}

      {/* ─── EN-TÊTE DE LA PAGE ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{pageTitle}</h1>
            {isAdmin ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs",
                  publicationCycle === "brouillon" && "border-amber-300 bg-amber-50 text-amber-800",
                  publicationCycle === "valide" && "border-blue-300 bg-blue-50 text-blue-800",
                  publicationCycle === "publie" && "border-emerald-300 bg-emerald-50 text-emerald-800",
                )}
              >
                {publicationCycle === "brouillon" && `Brouillon · version ${versionNumber}`}
                {publicationCycle === "valide" && `Validé · version ${versionNumber}`}
                {publicationCycle === "publie" && "Publié officiel"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Emploi du temps officiel
              </span>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setQualityModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/90 px-3 py-0.5 text-xs font-bold text-indigo-700 shadow-2xs transition-colors hover:bg-indigo-100"
                title="Cliquer pour analyser les contraintes dures et souples"
              >
                <Sparkles className="size-3.5 text-indigo-600" aria-hidden="true" />
                Score Timefold : {score.totalScore}/100
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sousTitreSemaine(week.debut)}</p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleModalOpen(true)}
              className="border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100/70"
            >
              <Zap className="mr-1.5 size-3.5 text-amber-600" aria-hidden="true" />
              Replanifier un imprévu
            </Button>
            <Button
              variant={simulationActive ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSimulationActive(!simulationActive);
                toast.info(simulationActive ? "Simulation terminée." : "Mode simulation activé. Testez un déplacement !");
              }}
              className={cn(
                "text-xs font-semibold shadow-2xs",
                simulationActive ? "bg-amber-600 text-white hover:bg-amber-700" : "border-slate-300 bg-white",
              )}
            >
              <Sliders className="mr-1.5 size-3.5" aria-hidden="true" />
              Simulation (« Et si ? »)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800"
              title="Réinitialiser"
            >
              <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
              Réinitialiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoGenerate}
              disabled={unplaced.length === 0 || !isGroupMode || autoGenerating}
              className="border-slate-300 bg-white text-xs font-semibold shadow-2xs hover:bg-slate-50"
            >
              <Sparkles className="mr-1.5 size-3.5 text-indigo-600" aria-hidden="true" />
              Générer automatiquement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidateDraft}
              disabled={publicationCycle !== "brouillon"}
              className="border-slate-300 bg-white text-xs font-semibold shadow-2xs hover:bg-slate-50"
            >
              <FileCheck className="mr-1.5 size-3.5 text-slate-600" aria-hidden="true" />
              Valider le brouillon
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              className="bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
            >
              <Send className="mr-1.5 size-3.5" aria-hidden="true" />
              Publier
            </Button>
          </div>
        )}
      </div>

      {/* ─── BARRE DE FILTRES : SÉLECTEURS + LÉGENDE ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50/70 p-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {!isStudent && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("group")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "group" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Users className="size-3.5" aria-hidden="true" />
                Groupe
              </button>
              <button
                type="button"
                onClick={() => setViewMode("teacher")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "teacher" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <User className="size-3.5" aria-hidden="true" />
                Enseignant
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setViewMode("room")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    viewMode === "room" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Building2 className="size-3.5" aria-hidden="true" />
                  Salle
                </button>
              )}
            </div>
          )}

          {isStudent && (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800">
              <span className="font-normal text-slate-400">Classe :</span>
              <span className="text-blue-700">{groupeCible?.nom ?? studentGroup?.nom ?? "Groupe 1"}</span>
            </div>
          )}

          {!isStudent && viewMode === "group" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Groupe</span>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="h-8 cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {(groups.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nom}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {viewMode === "teacher" && !isStudent && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Enseignant</span>
              <div className="relative">
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="h-8 cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {teacherNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {isAdmin && viewMode === "room" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Salle</span>
              <div className="relative">
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="h-8 cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {roomNames.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          )}

          {/* Semaine */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-muted-foreground">Semaine</span>
            <div className="relative">
              <select
                value={weekKey}
                onChange={(e) => handleWeekChange(e.target.value)}
                className="h-8 cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SEMAINES.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Légende couleurs */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue-500" aria-hidden="true" />
            <span>Cours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>TD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>TP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-purple-500" aria-hidden="true" />
            <span>Examen</span>
          </div>
        </div>
      </div>

      {/* ─── DISPOSITION PRINCIPALE ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Colonne gauche admin : uniquement pour l'admin en vue groupe */}
        {isAdmin && isGroupMode && (
          <div className="space-y-4 lg:col-span-3">
            {/* CARD 1 : SÉANCES À PLACER */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900">Séances à placer</CardTitle>
                <span className="inline-flex items-center justify-center rounded-full border bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {unplaced.length}
                </span>
              </CardHeader>
              <CardContent className="space-y-2.5 p-4 pt-2">
                {unplaced.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="mx-auto mb-1.5 size-6 text-emerald-500" aria-hidden="true" />
                    Toutes les séances de {groupeCible?.nom ?? selectedGroup} sont placées dans la grille.
                  </div>
                ) : (
                  unplaced.map((item) => {
                    const isSelected = activeDraggingId === item.id;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setActiveDraggingId(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveDraggingId(item.id);
                          }
                        }}
                        draggable
                        onDragStart={() => setActiveDraggingId(item.id)}
                        className={cn(
                          "cursor-grab select-none rounded-xl border p-3 text-xs shadow-2xs transition-all active:cursor-grabbing",
                          isSelected
                            ? "border-amber-400 bg-amber-50/80 shadow-sm ring-2 ring-amber-300"
                            : "border-slate-200 bg-white shadow-2xs hover:border-slate-300",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-3xs font-extrabold uppercase tracking-wide text-amber-800">
                            {isSelected ? `${item.kind} · EN COURS DE DÉPLACEMENT` : item.kind}
                          </span>
                          {isSelected && <span className="size-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />}
                        </div>
                        <h4 className="mt-1 text-sm font-bold text-slate-900">{item.title}</h4>
                        <p className="mt-1 text-3xs font-medium text-slate-500">
                          {item.teacher || "Enseignant du cours"} · {item.room || "salle au choix"} · {item.duration}
                        </p>
                      </div>
                    );
                  })
                )}
                {unplaced.length > 0 && (
                  <p className="pt-1 text-3xs italic text-slate-400">
                    Glisse une séance sur un créneau vert de la grille (ou clique dessus puis sur le créneau).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* CARD 2 : CONTRÔLES DU SOLVEUR */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>Contrôles du Solveur</span>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-3xs font-black text-indigo-600">
                    {score.totalScore}/100
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-1 text-xs">
                <div className="flex items-start gap-2 text-emerald-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="font-semibold text-slate-800">
                    {conflits.length === 0 ? "Contraintes dures respectées (0 conflit)" : `${conflits.length} conflit(s) dur(s) détecté(s)`}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <span className="text-3xs leading-relaxed text-slate-600">
                    <strong className="text-amber-800">Contraintes souples :</strong> {score.breakdown.trous} trou(s),{" "}
                    {score.breakdown.prefsEnseignants}% préférences profs respectées.
                  </span>
                </div>
                <div className="space-y-1.5 border-t pt-2">
                  <div className="flex items-center justify-between text-3xs font-semibold">
                    <span className="text-slate-600">Charge horaire du groupe</span>
                    <span className="text-slate-900">
                      {Math.round(chargeHeures * 10) / 10} h / {maxHeures} h
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all", chargeHeures >= 20 ? "bg-amber-500" : "bg-blue-600")}
                      style={{ width: `${Math.min(100, (chargeHeures / maxHeures) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD 3 : CYCLE DE PUBLICATION */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900">Cycle de publication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-1 text-xs">
                <label className="flex cursor-pointer items-center gap-2.5 font-medium text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "brouillon"}
                    onChange={() => sauvegarderCycle("brouillon", versionNumber)}
                    className="size-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Brouillon</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 font-medium text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "valide"}
                    onChange={() => sauvegarderCycle("valide", versionNumber)}
                    className="size-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Validé</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 font-medium text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "publie"}
                    onChange={() => sauvegarderCycle("publie", versionNumber)}
                    className="size-3.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Publié</span>
                </label>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Colonne droite : grille de l'emploi du temps */}
        <div className={cn(isAdmin && isGroupMode ? "lg:col-span-9" : "lg:col-span-12")}>
          <QueryBoundary query={timetable} moduleName="Emploi du temps">
            {() => (
              <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b bg-slate-50/70 text-xs font-bold text-slate-800">
                        <th className="w-20 border-r p-3 text-center font-semibold text-slate-400">Créneau</th>
                        {jours.map((day) => (
                          <th key={day.id} className="min-w-[155px] border-r p-3 text-center last:border-r-0">
                            <span>{day.label}</span> <span className="font-normal text-slate-400">{day.dateNum}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {creneaux.map((slot) => (
                        <tr key={`${slot.start}-${slot.end}`} className="h-28">
                          <td className="border-r bg-slate-50/30 p-2 text-center align-middle text-xs font-semibold text-slate-600">
                            <div className="text-3xs font-bold text-slate-700">{slot.start}</div>
                            <div className="text-3xs text-slate-400">{slot.end}</div>
                          </td>
                          {jours.map((day) => {
                            const seancesCellule = dansCellule(day.id, slot);
                            const conflitCell =
                              isAdmin && isGroupMode ? conflits.find((c) => c.day === day.id && c.start === slot.start) : undefined;
                            const isTarget = highlightTarget?.day === day.id && highlightTarget?.start === slot.start;
                            return (
                              <td
                                key={`${day.id}-${slot.start}`}
                                className="border-r p-1.5 align-top last:border-r-0"
                                onDragOver={(e) => {
                                  if (isAdmin && isGroupMode && !conflitCell && seancesCellule.length === 0) {
                                    e.preventDefault();
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (isAdmin && isGroupMode && activeDraggingId) {
                                    const item = unplaced.find((u) => u.id === activeDraggingId);
                                    if (item) handlePlaceSession(item, day.id, slot);
                                  }
                                }}
                              >
                                {/* CASE 1 : CONFLIT */}
                                {seancesCellule.length === 0 && conflitCell ? (
                                  <div className="flex h-full min-h-[96px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-rose-300 bg-rose-50/80 p-2 text-center text-rose-700 shadow-2xs">
                                    <X className="mb-0.5 size-4 text-rose-600" aria-hidden="true" />
                                    <span className="text-3xs font-bold leading-tight">{conflitCell.reason}</span>
                                  </div>
                                ) : seancesCellule.length > 0 ? (
                                  /* CASE 2 : SÉANCE PLANIFIÉE */
                                  seancesCellule.map((s) => (
                                    <div
                                      key={s.id}
                                      className={cn(
                                        "group relative mb-1 flex h-full min-h-[96px] w-full flex-col justify-between rounded-xl border p-2.5 shadow-2xs transition-all last:mb-0",
                                        KIND_COLORS[s.kind]?.bg,
                                        KIND_COLORS[s.kind]?.border,
                                        isTarget && "border-blue-400 ring-2 ring-blue-500",
                                      )}
                                    >
                                      {isAdmin && isGroupMode && (
                                        <button
                                          type="button"
                                          onClick={() => setToDelete(s)}
                                          title="Retirer cette séance"
                                          className="absolute right-1.5 top-1.5 hidden rounded-md p-0.5 text-slate-400 transition-colors hover:bg-black/10 hover:text-rose-600 group-hover:block"
                                        >
                                          <X className="size-3" aria-hidden="true" />
                                        </button>
                                      )}
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <span
                                            className={cn(
                                              "text-3xs font-extrabold uppercase tracking-wide",
                                              s.kind === "COURS" && "text-blue-700",
                                              s.kind === "TD" && "text-emerald-700",
                                              s.kind === "TP" && "text-amber-800",
                                            )}
                                          >
                                            {s.kind}
                                          </span>
                                          {(!isGroupMode || !isStudent) && s.group && (
                                            <span className="rounded border border-slate-200 bg-white/70 px-1.5 py-0.2 text-3xs font-bold text-slate-500">
                                              {s.group}
                                            </span>
                                          )}
                                        </div>
                                        <h5 className={cn("mt-1 text-xs font-bold leading-snug", KIND_COLORS[s.kind]?.text)}>{s.title}</h5>
                                      </div>
                                      <div className="mt-1 flex items-center justify-between text-3xs font-medium text-slate-600">
                                        <span className="truncate">{s.teacher}</span>
                                        {isAdmin ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTargetSessionForRoom(s);
                                              setRoomModalOpen(true);
                                            }}
                                            className="ml-1 font-bold text-blue-700 underline decoration-dotted hover:text-blue-900"
                                            title="Cliquer pour changer de salle avec suggestion intelligente"
                                          >
                                            {s.room}
                                          </button>
                                        ) : (
                                          <span className="ml-1 font-semibold">{s.room}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  /* CASE 3 : CRÉNEAU LIBRE */
                                  <button
                                    type="button"
                                    disabled={!isAdmin || !isGroupMode}
                                    onClick={() => {
                                      if (!isAdmin || !isGroupMode) return;
                                      if (simulationActive) {
                                        // Simulation : aucun write, on ne montre que l'impact du déplacement.
                                        const jourObj = { start: slot.start, end: slot.end };
                                        const occupe = scheduled.some((s) => s.day === day.id && chevauchent(s, jourObj));
                                        setSimulationImpact({
                                          ...impactDeplacement(
                                            score.totalScore,
                                            indexCreneau(slot.start),
                                            occupe || conflits.some((c) => c.day === day.id && c.start === slot.start),
                                          ),
                                          fromSlot: activeDraggingId ? "Liste à placer" : "Créneau actuel",
                                          fromDay: "",
                                          toSlot: `${slot.start}–${slot.end}`,
                                          toDay: day.label,
                                        });
                                        toast.info("Impact simulé : aucun changement enregistré.");
                                        return;
                                      }
                                      if (activeDraggingId) {
                                        const item = unplaced.find((u) => u.id === activeDraggingId);
                                        if (item) handlePlaceSession(item, day.id, slot);
                                      } else {
                                        openCreate({
                                          day: String(day.id),
                                          start: slot.start,
                                          end: slot.end,
                                        });
                                      }
                                    }}
                                    onMouseEnter={() => {
                                      if (isAdmin && isGroupMode && activeDraggingId) {
                                        setHighlightTarget({ day: day.id, start: slot.start, end: slot.end });
                                      }
                                    }}
                                    onMouseLeave={() => setHighlightTarget(null)}
                                    className={cn(
                                      "flex h-full min-h-[96px] w-full select-none flex-col items-center justify-center rounded-xl text-xs font-medium transition-all",
                                      isAdmin && isGroupMode
                                        ? "cursor-pointer border border-dashed border-emerald-300 bg-emerald-50/40 font-semibold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100/60"
                                        : "border border-slate-100 bg-slate-50/40 text-slate-300",
                                    )}
                                  >
                                    <span className={isAdmin && isGroupMode ? "text-emerald-700" : "text-slate-400"}>Libre</span>
                                    {isAdmin && isGroupMode && activeDraggingId && (
                                      <span className="mt-0.5 text-3xs font-normal text-emerald-600">Cliquer pour déposer</span>
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </QueryBoundary>
        </div>
      </div>

      {/* ─── MODAL 1 : ANALYSE TIMEFOLD (SCORE DE QUALITÉ) ────────────────────── */}
      <Dialog open={qualityModalOpen} onOpenChange={setQualityModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-600" aria-hidden="true" />
            <span>Score de Qualité Timefold Solver (OR-Tools)</span>
          </DialogTitle>
          <DialogDescription>
            Analyse mathématique multicritère de l'emploi du temps du groupe {groupeCible?.nom ?? selectedGroup}.
          </DialogDescription>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
              <div>
                <span className="text-3xs font-extrabold uppercase text-indigo-700">Score global d'optimisation</span>
                <div className="mt-0.5 text-3xl font-black text-indigo-900">{score.totalScore} / 100</div>
              </div>
              <div className="text-right text-xs">
                <span className="block font-bold text-emerald-700">✓ Contraintes dures : {score.hardScore}%</span>
                <span className="mt-0.5 block font-bold text-blue-700">~ Contraintes souples : {score.softScore}%</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-slate-900">Détail des contraintes :</h4>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
                  <strong>Contraintes dures (Hard) :</strong> conflits enseignant, salle &amp; classe
                </span>
                <span className={conflits.length === 0 ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>
                  {conflits.length === 0 ? "Respecté (100%)" : `${conflits.length} conflit(s)`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-600" aria-hidden="true" />
                  <strong>Minimisation des trous :</strong> {score.breakdown.trous} trou(s) détecté(s)
                </span>
                <span className={score.breakdown.trous === 0 ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                  {score.breakdown.trous === 0 ? "Idéal (0 trou)" : `Pénalité (-${score.breakdown.trous * 8} pts)`}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600" aria-hidden="true" />
                  <strong>Préférences enseignants :</strong> créneaux matinaux vs après-midi
                </span>
                <span className="font-bold text-blue-700">{score.breakdown.prefsEnseignants}% conformité</span>
              </div>
            </div>

            <div className="flex justify-end border-t pt-2">
              <Button size="sm" onClick={() => setQualityModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2 : REPLANIFICATION D'IMPRÉVU (3 CRÉNEAUX DE RATTRAPAGE) ───── */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-amber-600" aria-hidden="true" />
            <span>Replanification d'Imprévu (Rattrapage Intelligent)</span>
          </DialogTitle>
          <DialogDescription>
            Le système détecte les créneaux libres sans aucun conflit d'enseignant ni de salle et propose 3 solutions optimales.
          </DialogDescription>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUnforeseenReason("teacher_absent")}
                className={cn(
                  "rounded-lg border p-2.5 text-center transition-all",
                  unforeseenReason === "teacher_absent"
                    ? "border-amber-500 bg-amber-50 font-bold text-amber-900"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                Enseignant absent / indisponible
              </button>
              <button
                type="button"
                onClick={() => setUnforeseenReason("room_unavailable")}
                className={cn(
                  "rounded-lg border p-2.5 text-center transition-all",
                  unforeseenReason === "room_unavailable"
                    ? "border-amber-500 bg-amber-50 font-bold text-amber-900"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                Salle indisponible / fermée
              </button>
            </div>

            <div>
              <label htmlFor="reschedule-session" className="mb-1 block text-xs font-bold text-slate-800">
                Séance à replanifier :
              </label>
              <select
                id="reschedule-session"
                value={selectedSessionToRescheduleId}
                onChange={(e) => setSelectedSessionToRescheduleId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs"
              >
                <option value="">-- Choisir la séance impactée ({scheduled.length} séances) --</option>
                {scheduled.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.kind}) · {s.teacher} · {jours.find((d) => d.id === s.day)?.label} à {s.start}–{s.end}
                  </option>
                ))}
              </select>
            </div>

            {selectedSessionToRescheduleId && (
              <div className="space-y-2 border-t pt-2">
                <span className="block text-xs font-extrabold text-slate-900">3 créneaux de rattrapage proposés sans aucun conflit :</span>
                {rescheduleOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:border-amber-300 hover:bg-amber-50/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-slate-900 text-3xs font-black text-white">
                          {opt.delta >= 4 ? "★" : "+"}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {opt.dayLabel} {opt.dateNum} · {opt.slotLabel}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-3xs font-bold text-emerald-800">
                          {opt.qualite} (+{opt.delta} pts)
                        </span>
                      </div>
                      <p className="mt-1 text-3xs text-slate-500">
                        {opt.explication} — salle suggérée : {opt.room}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleApplyReschedule(opt)}
                      className="bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Replanifier
                    </Button>
                  </div>
                ))}
                {rescheduleOptions.length === 0 && (
                  <p className="text-xs text-slate-500">Aucun créneau de rattrapage libre cette semaine.</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 3 : SUGGESTION INTELLIGENTE DE SALLES ──────────────────────── */}
      <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" aria-hidden="true" />
            <span>Suggestion Intelligente de Salles</span>
          </DialogTitle>
          <DialogDescription>
            Salles libres sur le créneau {targetSessionForRoom?.start}–{targetSessionForRoom?.end}, classées selon la typologie pédagogique
            ({targetSessionForRoom?.kind === "COURS" ? "cours magistral" : targetSessionForRoom?.kind}).
          </DialogDescription>

          <div className="max-h-80 space-y-2 overflow-y-auto pt-1">
            {smartRoomSuggestions.map((s) => (
              <div
                key={s.nom}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-3 transition-all",
                  s.recommandee ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{s.nom}</span>
                    {s.recommandee && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-3xs font-bold text-emerald-800">Recommandée</span>
                    )}
                    {!s.dispo && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-3xs font-bold text-rose-700">Occupée</span>}
                  </div>
                  <p className="mt-0.5 text-3xs text-slate-500">
                    {s.raison}
                    {s.capacite ? ` · capacité ${s.capacite}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!s.dispo}
                  onClick={() => void handleApplyRoom(s.nom)}
                  className={cn("text-xs font-semibold", s.dispo ? "bg-blue-600 text-white hover:bg-blue-700" : "")}
                >
                  Assigner
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE CRÉATION / PLACEMENT D'UNE SÉANCE (données réelles) ───── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Planifier une séance</DialogTitle>
          <DialogDescription>
            Cette action crée une séance réelle : cours, classe, salle, type et créneau. Le backend refuse les conflits (409).
          </DialogDescription>

          {(liveConflict || conflict) && <ConflictAlert description={liveConflict || conflict || ""} className="mb-3" />}

          <div className="grid gap-3 py-2">
            <label className="grid gap-1 text-sm">
              Cours
              <Select
                value={form.coursId}
                onChange={(e) => {
                  const cid = e.target.value;
                  const availableGrps = (groups.data ?? []).filter(
                    (g) => !cid || g.coursId === cid || (g.affectations ?? []).some((a) => a.coursId === cid),
                  );
                  setForm((f) => ({
                    ...f,
                    coursId: cid,
                    groupeId: availableGrps.some((g) => g.id === f.groupeId) ? f.groupeId : (availableGrps[0]?.id ?? f.groupeId),
                  }));
                }}
              >
                <option value="">—</option>
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
                Salle
                <Select value={form.salleId} onChange={(e) => setForm((f) => ({ ...f, salleId: e.target.value }))}>
                  <option value="">—</option>
                  {(rooms.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nom}
                      {r.batiment ? ` (${r.batiment})` : ""}
                    </option>
                  ))}
                </Select>
              </label>

              <label htmlFor="session-kind" className="grid gap-1 text-sm">
                Type
                <Select
                  id="session-kind"
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as SessionKind }))}
                >
                  <option value="CM">CM (Cours)</option>
                  <option value="TD">TD</option>
                  <option value="TP">TP</option>
                </Select>
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              Classe
              <Select value={form.groupeId} onChange={(e) => setForm((f) => ({ ...f, groupeId: e.target.value }))}>
                <option value="">—</option>
                {groupesDuCours.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </Select>
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="grid gap-1 text-sm">
                Jour
                <Select value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}>
                  {jours.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <label htmlFor="session-start" className="grid gap-1 text-sm">
                  Début
                  <Input
                    id="session-start"
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />
                </label>
                <label htmlFor="session-end" className="grid gap-1 text-sm">
                  Fin
                  <Input id="session-end" type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={() => void handleCreate()} disabled={submitting || Boolean(liveConflict)} className="bg-blue-600 text-white hover:bg-blue-700">
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de retrait d'une séance (protège les données réelles) */}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="Retirer cette séance ?"
        description={
          toDelete
            ? `« ${toDelete.title} » du ${jours.find((d) => d.id === toDelete.day)?.label ?? ""} à ${toDelete.start} sera désplanifiée et retournera dans la liste « Séances à placer ».`
            : ""
        }
        confirmLabel={deleting ? "Suppression…" : "Retirer"}
        loading={deleting}
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
