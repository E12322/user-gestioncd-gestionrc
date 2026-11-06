//import { Card } from "@/shared/components/ui/card";
//import { useT } from "@/shared/i18n";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  RotateCcw,
  ChevronDown,
  X,
  FileCheck,
  Users,
  User,
  Building2,
  Zap,
  Sliders,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { useAuth } from "@/shared/auth/AuthContext";
import { cn } from "@/shared/lib/utils";
import {
  evaluateScheduleQuality,
  generateRescheduleOptions,
  getSmartRoomSuggestions,
  simulateMoveImpact,
  type RescheduleOption,
  type RoomSuggestion,
  type SimulationResult,
  CAMPUS_ROOMS,
} from "../services/constraintSolver";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type TimeSlotId = "08:30 - 10:00" | "10:15 - 11:45" | "13:30 - 15:00" | "15:15 - 16:45";
export type DayId = 1 | 2 | 3 | 4 | 5;
export type SessionKind = "COURS" | "TD" | "TP" | "EXAMEN";
export type ViewMode = "group" | "teacher" | "room";
export type PublicationCycle = "brouillon" | "valide" | "publie";

export interface ScheduledSession {
  id: string;
  kind: SessionKind;
  title: string;
  teacher: string;
  room: string;
  day: DayId;
  slot: TimeSlotId;
  duration?: string;
  group?: string;
  statusLabel?: string;
}

export interface FloatingSession {
  id: string;
  kind: SessionKind;
  title: string;
  teacher: string;
  room: string;
  duration: string;
  group: string;
}

export interface SlotConflict {
  day: DayId;
  slot: TimeSlotId;
  reason: string;
}

// ─── CONFIGURATION DES CRÉNEAUX ET DES SEMAINES ──────────────────────────────

const TIME_SLOTS: { id: TimeSlotId; start: string; end: string }[] = [
  { id: "08:30 - 10:00", start: "08:30", end: "10:00" },
  { id: "10:15 - 11:45", start: "10:15", end: "11:45" },
  { id: "13:30 - 15:00", start: "13:30", end: "15:00" },
  { id: "15:15 - 16:45", start: "15:15", end: "16:45" },
];

const WEEKS_DATA: Record<string, { label: string; dateSubtitle: string; days: { id: DayId; label: string; dateNum: string }[] }> = {
  S12: {
    label: "S12 · 16–20 nov.",
    dateSubtitle: "Semestre 1 · Semaine du 16 au 20 novembre 2026",
    days: [
      { id: 1, label: "Lundi", dateNum: "16" },
      { id: 2, label: "Mardi", dateNum: "17" },
      { id: 3, label: "Mercredi", dateNum: "18" },
      { id: 4, label: "Jeudi", dateNum: "19" },
      { id: 5, label: "Vendredi", dateNum: "20" },
    ],
  },
  S13: {
    label: "S13 · 23–27 nov.",
    dateSubtitle: "Semestre 1 · Semaine du 23 au 27 novembre 2026",
    days: [
      { id: 1, label: "Lundi", dateNum: "23" },
      { id: 2, label: "Mardi", dateNum: "24" },
      { id: 3, label: "Mercredi", dateNum: "25" },
      { id: 4, label: "Jeudi", dateNum: "26" },
      { id: 5, label: "Vendredi", dateNum: "27" },
    ],
  },
  S14: {
    label: "S14 · 30 nov.–4 déc.",
    dateSubtitle: "Semestre 1 · Semaine du 30 novembre au 4 décembre 2026",
    days: [
      { id: 1, label: "Lundi", dateNum: "30" },
      { id: 2, label: "Mardi", dateNum: "01" },
      { id: 3, label: "Mercredi", dateNum: "02" },
      { id: 4, label: "Jeudi", dateNum: "03" },
      { id: 5, label: "Vendredi", dateNum: "04" },
    ],
  },
};

const KIND_COLORS: Record<SessionKind, { bg: string; text: string; border: string }> = {
  COURS: {
    bg: "bg-blue-100/70 hover:bg-blue-100",
    text: "text-blue-900",
    border: "border-blue-200",
  },
  TD: {
    bg: "bg-emerald-100/70 hover:bg-emerald-100",
    text: "text-emerald-950",
    border: "border-emerald-200",
  },
  TP: {
    bg: "bg-amber-100/70 hover:bg-amber-100",
    text: "text-amber-950",
    border: "border-amber-200",
  },
  EXAMEN: {
    bg: "bg-purple-100/80 hover:bg-purple-100",
    text: "text-purple-950",
    border: "border-purple-200",
  },
};

const ALL_TEACHERS = [
  "Pr. Trabelsi",
  "Mr Chaabane",
  "Pr. Jlassi",
  "Mme Jlassi",
  "Pr. Mrad",
  "Pr. Gharbi",
  "Mme Ayari",
  "Mr Ouni",
  "Dr. Hammami",
  "Mme Zairi",
  "Dr. Sassi",
  "Mme Ben Amor",
];

const ALL_ROOMS = CAMPUS_ROOMS.map((r) => r.name);

// ─── EMPLOIS DU TEMPS INITIAUX PAR GROUPE ────────────────────────────────────

const INITIAL_DATA_BY_GROUP: Record<string, { scheduled: ScheduledSession[]; unplaced: FloatingSession[]; conflicts: SlotConflict[] }> = {
  "4INFO-B": {
    scheduled: [
      {
        id: "b-1",
        day: 1,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Génie logiciel",
        teacher: "Pr. Trabelsi",
        room: "Amphi A",
        group: "4INFO-B",
      },
      {
        id: "b-2",
        day: 1,
        slot: "10:15 - 11:45",
        kind: "COURS",
        title: "Bases de données",
        teacher: "Pr. Jlassi",
        room: "Amphi B",
        group: "4INFO-B",
      },
      {
        id: "b-3",
        day: 2,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Bases de données",
        teacher: "Mme Jlassi",
        room: "B102",
        group: "4INFO-B",
      },
      {
        id: "b-4",
        day: 2,
        slot: "15:15 - 16:45",
        kind: "TP",
        title: "Génie logiciel",
        teacher: "Mr Chaabane",
        room: "Labo L1",
        group: "4INFO-B",
      },
      {
        id: "b-5",
        day: 3,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Anglais technique",
        teacher: "Mme Ayari",
        room: "B105",
        group: "4INFO-B",
      },
      {
        id: "b-6",
        day: 3,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Réseaux avancés",
        teacher: "Pr. Gharbi",
        room: "Labo L3",
        group: "4INFO-B",
        statusLabel: "DÉPOSER ICI",
      },
      {
        id: "b-7",
        day: 3,
        slot: "13:30 - 15:00",
        kind: "TD",
        title: "Architecture logicielle",
        teacher: "Mr Mrad",
        room: "B103",
        group: "4INFO-B",
      },
      {
        id: "b-8",
        day: 4,
        slot: "10:15 - 11:45",
        kind: "TD",
        title: "Génie logiciel",
        teacher: "Mr Chaabane",
        room: "B104",
        group: "4INFO-B",
      },
      {
        id: "b-9",
        day: 4,
        slot: "13:30 - 15:00",
        kind: "TP",
        title: "Bases de données",
        teacher: "Mme Jlassi",
        room: "Labo L2",
        group: "4INFO-B",
      },
      {
        id: "b-10",
        day: 5,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Architecture logicielle",
        teacher: "Pr. Mrad",
        room: "Amphi A",
        group: "4INFO-B",
      },
      {
        id: "b-11",
        day: 5,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Projet intégré",
        teacher: "Mr Ouni",
        room: "Labo L1",
        group: "4INFO-B",
      },
      {
        id: "b-12",
        day: 5,
        slot: "15:15 - 16:45",
        kind: "EXAMEN",
        title: "DS Génie logiciel",
        teacher: "",
        room: "Amphi B",
        group: "4INFO-B",
      },
    ],
    unplaced: [
      { id: "u-1", kind: "TP", title: "Réseaux avancés", teacher: "Pr. Gharbi", room: "Labo L3", duration: "1 h 30", group: "4INFO-B" },
      { id: "u-2", kind: "TP", title: "Systèmes embarqués", teacher: "Mr Ouni", room: "Labo L2", duration: "1 h 30", group: "4INFO-B" },
      { id: "u-3", kind: "TD", title: "Anglais technique", teacher: "Mme Ayari", room: "B105", duration: "1 h 30", group: "4INFO-B" },
    ],
    conflicts: [
      { day: 2, slot: "13:30 - 15:00", reason: "Pr. Gharbi déjà en 4INFO-A" },
      { day: 4, slot: "08:30 - 10:00", reason: "Labo L3 occupé" },
    ],
  },
  "4INFO-A": {
    scheduled: [
      {
        id: "a-1",
        day: 1,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Génie logiciel",
        teacher: "Pr. Trabelsi",
        room: "Amphi A",
        group: "4INFO-A",
      },
      {
        id: "a-2",
        day: 1,
        slot: "13:30 - 15:00",
        kind: "TD",
        title: "Architecture logicielle",
        teacher: "Mr Mrad",
        room: "B101",
        group: "4INFO-A",
      },
      {
        id: "a-3",
        day: 2,
        slot: "10:15 - 11:45",
        kind: "COURS",
        title: "Bases de données",
        teacher: "Pr. Jlassi",
        room: "Amphi B",
        group: "4INFO-A",
      },
      {
        id: "a-4",
        day: 2,
        slot: "13:30 - 15:00",
        kind: "TP",
        title: "Réseaux avancés",
        teacher: "Pr. Gharbi",
        room: "Labo L3",
        group: "4INFO-A",
      },
      {
        id: "a-5",
        day: 3,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Génie logiciel",
        teacher: "Mr Chaabane",
        room: "B102",
        group: "4INFO-A",
      },
      {
        id: "a-6",
        day: 3,
        slot: "13:30 - 15:00",
        kind: "TP",
        title: "Bases de données",
        teacher: "Mme Jlassi",
        room: "Labo L2",
        group: "4INFO-A",
      },
      {
        id: "a-7",
        day: 4,
        slot: "08:30 - 10:00",
        kind: "TP",
        title: "Systèmes embarqués",
        teacher: "Mr Ouni",
        room: "Labo L3",
        group: "4INFO-A",
      },
      {
        id: "a-8",
        day: 4,
        slot: "13:30 - 15:00",
        kind: "TD",
        title: "Anglais technique",
        teacher: "Mme Ayari",
        room: "B105",
        group: "4INFO-A",
      },
      {
        id: "a-9",
        day: 5,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Architecture logicielle",
        teacher: "Pr. Mrad",
        room: "Amphi A",
        group: "4INFO-A",
      },
      {
        id: "a-10",
        day: 5,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Projet intégré",
        teacher: "Mr Ouni",
        room: "Labo L1",
        group: "4INFO-A",
      },
    ],
    unplaced: [
      { id: "ua-1", kind: "TD", title: "Anglais technique", teacher: "Mme Ayari", room: "B105", duration: "1 h 30", group: "4INFO-A" },
    ],
    conflicts: [],
  },
  "4INFO-C": {
    scheduled: [
      {
        id: "c-1",
        day: 1,
        slot: "10:15 - 11:45",
        kind: "COURS",
        title: "Génie logiciel",
        teacher: "Pr. Trabelsi",
        room: "Amphi A",
        group: "4INFO-C",
      },
      {
        id: "c-2",
        day: 2,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Bases de données",
        teacher: "Pr. Jlassi",
        room: "Amphi B",
        group: "4INFO-C",
      },
      {
        id: "c-3",
        day: 2,
        slot: "10:15 - 11:45",
        kind: "TD",
        title: "Bases de données",
        teacher: "Mme Jlassi",
        room: "B103",
        group: "4INFO-C",
      },
      {
        id: "c-4",
        day: 3,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Architecture logicielle",
        teacher: "Pr. Mrad",
        room: "Amphi A",
        group: "4INFO-C",
      },
      {
        id: "c-5",
        day: 4,
        slot: "13:30 - 15:00",
        kind: "TD",
        title: "Anglais technique",
        teacher: "Mme Ayari",
        room: "B105",
        group: "4INFO-C",
      },
      {
        id: "c-6",
        day: 5,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Génie logiciel",
        teacher: "Mr Chaabane",
        room: "Labo L1",
        group: "4INFO-C",
      },
    ],
    unplaced: [
      { id: "uc-1", kind: "TP", title: "Réseaux avancés", teacher: "Pr. Gharbi", room: "Labo L3", duration: "1 h 30", group: "4INFO-C" },
      { id: "uc-2", kind: "TP", title: "Bases de données", teacher: "Mme Jlassi", room: "Labo L2", duration: "1 h 30", group: "4INFO-C" },
    ],
    conflicts: [],
  },
  "3INFO-A": {
    scheduled: [
      {
        id: "3a-1",
        day: 1,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Algorithmique avancée",
        teacher: "Dr. Hammami",
        room: "Amphi C",
        group: "3INFO-A",
      },
      {
        id: "3a-2",
        day: 1,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Programmation Web",
        teacher: "Mr Ouni",
        room: "Labo L1",
        group: "3INFO-A",
      },
      {
        id: "3a-3",
        day: 2,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Probabilités & Stats",
        teacher: "Mme Zairi",
        room: "B201",
        group: "3INFO-A",
      },
      {
        id: "3a-4",
        day: 3,
        slot: "13:30 - 15:00",
        kind: "COURS",
        title: "Systèmes d'exploitation",
        teacher: "Pr. Trabelsi",
        room: "Amphi B",
        group: "3INFO-A",
      },
      {
        id: "3a-5",
        day: 4,
        slot: "10:15 - 11:45",
        kind: "TP",
        title: "Programmation Web",
        teacher: "Mr Ouni",
        room: "Labo L2",
        group: "3INFO-A",
      },
      {
        id: "3a-6",
        day: 5,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Algorithmique avancée",
        teacher: "Dr. Hammami",
        room: "B204",
        group: "3INFO-A",
      },
      {
        id: "3a-7",
        day: 5,
        slot: "13:30 - 15:00",
        kind: "EXAMEN",
        title: "DS Algorithmique",
        teacher: "",
        room: "Amphi C",
        group: "3INFO-A",
      },
    ],
    unplaced: [
      {
        id: "u3a-1",
        kind: "TD",
        title: "Systèmes d'exploitation",
        teacher: "Pr. Trabelsi",
        room: "B202",
        duration: "1 h 30",
        group: "3INFO-A",
      },
    ],
    conflicts: [],
  },
  "3INFO-B": {
    scheduled: [
      {
        id: "3b-1",
        day: 1,
        slot: "10:15 - 11:45",
        kind: "COURS",
        title: "Algorithmique avancée",
        teacher: "Dr. Hammami",
        room: "Amphi C",
        group: "3INFO-B",
      },
      {
        id: "3b-2",
        day: 2,
        slot: "10:15 - 11:45",
        kind: "TD",
        title: "Probabilités & Stats",
        teacher: "Mme Zairi",
        room: "B201",
        group: "3INFO-B",
      },
      {
        id: "3b-3",
        day: 3,
        slot: "08:30 - 10:00",
        kind: "TP",
        title: "Programmation Web",
        teacher: "Mr Ouni",
        room: "Labo L1",
        group: "3INFO-B",
      },
      {
        id: "3b-4",
        day: 4,
        slot: "13:30 - 15:00",
        kind: "COURS",
        title: "Systèmes d'exploitation",
        teacher: "Pr. Trabelsi",
        room: "Amphi B",
        group: "3INFO-B",
      },
    ],
    unplaced: [
      { id: "u3b-1", kind: "TP", title: "Programmation Web", teacher: "Mr Ouni", room: "Labo L2", duration: "1 h 30", group: "3INFO-B" },
    ],
    conflicts: [],
  },
  "2INFO-A": {
    scheduled: [
      {
        id: "2a-1",
        day: 1,
        slot: "08:30 - 10:00",
        kind: "COURS",
        title: "Langage C",
        teacher: "Dr. Sassi",
        room: "Amphi B",
        group: "2INFO-A",
      },
      {
        id: "2a-2",
        day: 2,
        slot: "08:30 - 10:00",
        kind: "TP",
        title: "Langage C",
        teacher: "Mme Zairi",
        room: "Labo L4",
        group: "2INFO-A",
      },
      {
        id: "2a-3",
        day: 3,
        slot: "10:15 - 11:45",
        kind: "COURS",
        title: "Architecture des ordinateurs",
        teacher: "Pr. Mrad",
        room: "Amphi A",
        group: "2INFO-A",
      },
      {
        id: "2a-4",
        day: 4,
        slot: "08:30 - 10:00",
        kind: "TD",
        title: "Mathématiques pour l'ingénieur",
        teacher: "Mme Ben Amor",
        room: "B101",
        group: "2INFO-A",
      },
      { id: "2a-5", day: 5, slot: "10:15 - 11:45", kind: "TD", title: "Langage C", teacher: "Dr. Sassi", room: "B103", group: "2INFO-A" },
    ],
    unplaced: [
      {
        id: "u2a-1",
        kind: "TP",
        title: "Architecture des ordinateurs",
        teacher: "Pr. Mrad",
        room: "Labo L1",
        duration: "1 h 30",
        group: "2INFO-A",
      },
    ],
    conflicts: [],
  },
};

const AVAILABLE_GROUPS = ["4INFO-B", "4INFO-A", "4INFO-C", "3INFO-A", "3INFO-B", "2INFO-A"];

const ALL_SESSIONS_FLAT: ScheduledSession[] = Object.values(INITIAL_DATA_BY_GROUP).flatMap((d) => d.scheduled);

export default function TimetablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const isStudent = role === "student";
  const isTeacher = role === "teacher";

  // Vue active : groupe / enseignant / salle
  const [viewMode, setViewMode] = useState<ViewMode>(isTeacher ? "teacher" : "group");

  const initialGroupFromUrl = searchParams.get("group") || "4INFO-B";
  const [selectedGroup, setSelectedGroup] = useState<string>(
    AVAILABLE_GROUPS.includes(initialGroupFromUrl) ? initialGroupFromUrl : "4INFO-B",
  );

  const [selectedTeacher, setSelectedTeacher] = useState<string>(
    user?.name && ALL_TEACHERS.includes(user.name) ? user.name : ALL_TEACHERS[0],
  );

  const [selectedRoom, setSelectedRoom] = useState<string>(ALL_ROOMS[0]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("S12");
  const [publicationCycle, setPublicationCycle] = useState<PublicationCycle>("brouillon");
  const [versionNumber, setVersionNumber] = useState(3);

  // Clefs de stockage
  const storageScheduleKey = `smartcampus_sched_${selectedGroup}_${selectedWeekKey}`;
  const storageUnplacedKey = `smartcampus_unplaced_${selectedGroup}_${selectedWeekKey}`;

  const groupBaseData = useMemo(() => {
    return INITIAL_DATA_BY_GROUP[selectedGroup] || INITIAL_DATA_BY_GROUP["4INFO-B"];
  }, [selectedGroup]);

  const [scheduled, setScheduled] = useState<ScheduledSession[]>(() => {
    try {
      const saved = localStorage.getItem(storageScheduleKey);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return groupBaseData.scheduled;
  });

  const [unplaced, setUnplaced] = useState<FloatingSession[]>(() => {
    try {
      const saved = localStorage.getItem(storageUnplacedKey);
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return groupBaseData.unplaced;
  });

  // Mode simulation (« Et si ? ») et état du drag & drop : déclarés avant l'effet qui les réinitialise.
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationImpact, setSimulationImpact] = useState<SimulationResult | null>(null);
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<{ day: DayId; slot: TimeSlotId } | null>(null);

  // Recharger le planning quand le groupe ou la semaine change
  useEffect(() => {
    try {
      const savedSched = localStorage.getItem(storageScheduleKey);
      const savedUnplaced = localStorage.getItem(storageUnplacedKey);
      setScheduled(savedSched ? JSON.parse(savedSched) : groupBaseData.scheduled);
      setUnplaced(savedUnplaced ? JSON.parse(savedUnplaced) : groupBaseData.unplaced);
    } catch {
      setScheduled(groupBaseData.scheduled);
      setUnplaced(groupBaseData.unplaced);
    }
    setActiveDraggingId(null);
    setHighlightTarget(null);
    setSimulationImpact(null);
  }, [selectedGroup, selectedWeekKey, groupBaseData, storageScheduleKey, storageUnplacedKey]);

  // Sauvegarder dans localStorage (admin uniquement)
  useEffect(() => {
    if (!isAdmin) return;
    try {
      localStorage.setItem(storageScheduleKey, JSON.stringify(scheduled));
      localStorage.setItem(storageUnplacedKey, JSON.stringify(unplaced));
    } catch {
      /* ignore */
    }
  }, [isAdmin, scheduled, unplaced, storageScheduleKey, storageUnplacedKey]);

  const handleGroupChange = (newGroup: string) => {
    setSelectedGroup(newGroup);
    setSearchParams({ group: newGroup });
    toast.info(`Emploi du temps chargé : Groupe ${newGroup} (${WEEKS_DATA[selectedWeekKey].label})`);
  };

  const handleWeekChange = (newWeekKey: string) => {
    setSelectedWeekKey(newWeekKey);
    toast.info(`Semaine modifiée : ${WEEKS_DATA[newWeekKey].label}`);
  };

  // Conflits propres au groupe sélectionné
  const conflicts = useMemo(() => {
    if (selectedGroup === "4INFO-B" && selectedWeekKey === "S12") {
      return groupBaseData.conflicts;
    }
    return [];
  }, [selectedGroup, selectedWeekKey, groupBaseData]);

  // ─── 1. SCORE DE QUALITÉ TIMEFOLD / OR-TOOLS ──────────────────────────────
  const qualityScore = useMemo(() => {
    return evaluateScheduleQuality(scheduled, conflicts.length);
  }, [scheduled, conflicts]);

  const [qualityModalOpen, setQualityModalOpen] = useState(false);

  // ─── 2. REPLANIFICATION EN CAS D'IMPRÉVU ──────────────────────────────────
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [unforeseenReason, setUnforeseenReason] = useState<"teacher_absent" | "room_unavailable">("teacher_absent");
  const [selectedSessionToRescheduleId, setSelectedSessionToRescheduleId] = useState<string>("");

  const currentWeek = WEEKS_DATA[selectedWeekKey] || WEEKS_DATA["S12"];

  // Calcul des 3 créneaux de rattrapage
  const rescheduleOptions = useMemo<RescheduleOption[]>(() => {
    if (!selectedSessionToRescheduleId) return [];
    const sess = scheduled.find((s) => s.id === selectedSessionToRescheduleId);
    if (!sess) return [];
    return generateRescheduleOptions(sess, scheduled, currentWeek.days);
  }, [selectedSessionToRescheduleId, scheduled, currentWeek.days]);

  const handleApplyReschedule = (option: RescheduleOption) => {
    const sess = scheduled.find((s) => s.id === selectedSessionToRescheduleId);
    if (!sess) return;

    setScheduled((prev) =>
      prev.map((s) => {
        if (s.id === sess.id) {
          return {
            ...s,
            day: option.dayId as DayId,
            slot: option.slot as TimeSlotId,
            room: option.room,
          };
        }
        return s;
      }),
    );

    setRescheduleModalOpen(false);
    setSelectedSessionToRescheduleId("");
    toast.success(`Séance « ${sess.title} » replanifiée avec succès le ${option.dayLabel} à ${option.slot} (${option.room}) !`);
  };

  // ─── 3. SUGGESTION INTELLIGENTE DE SALLES LIBRES ──────────────────────────
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [targetSessionForRoom, setTargetSessionForRoom] = useState<ScheduledSession | null>(null);

  const smartRoomSuggestions = useMemo<RoomSuggestion[]>(() => {
    if (!targetSessionForRoom) return [];
    // Trouver les salles occupées sur ce jour et créneau
    const occupiedOnSlot = scheduled
      .filter((s) => s.day === targetSessionForRoom.day && s.slot === targetSessionForRoom.slot && s.id !== targetSessionForRoom.id)
      .map((s) => s.room);

    return getSmartRoomSuggestions(targetSessionForRoom.kind, occupiedOnSlot);
  }, [targetSessionForRoom, scheduled]);

  const handleApplyRoom = (roomName: string) => {
    if (!targetSessionForRoom) return;
    setScheduled((prev) => prev.map((s) => (s.id === targetSessionForRoom.id ? { ...s, room: roomName } : s)));
    setRoomModalOpen(false);
    setTargetSessionForRoom(null);
    toast.success(`Salle « ${roomName} » assignée à la séance !`);
  };

  // Sessions à afficher selon la vue
  const displayedSessions = useMemo(() => {
    if (viewMode === "group") return scheduled;
    if (viewMode === "teacher") {
      return ALL_SESSIONS_FLAT.filter((s) => s.teacher === selectedTeacher);
    }
    if (viewMode === "room") {
      return ALL_SESSIONS_FLAT.filter((s) => s.room === selectedRoom);
    }
    return scheduled;
  }, [viewMode, scheduled, selectedTeacher, selectedRoom]);

  const totalHours = scheduled.length * 1.5;
  const maxHours = 24;

  // ─── ACTIONS ADMINISTRATEUR DE BASE ───────────────────────────────────────

  const handlePlaceSession = (sessionToPlace: FloatingSession, day: DayId, slot: TimeSlotId) => {
    if (!isAdmin) return;
    const conflict = conflicts.find((c) => c.day === day && c.slot === slot);
    if (conflict) {
      toast.error(`Conflit bloquant : ${conflict.reason}`);
      return;
    }

    // Si on est en mode simulation (« Et si ? »)
    if (simulationActive) {
      const dayObj = currentWeek.days.find((d) => d.id === day);
      const impact = simulateMoveImpact(
        qualityScore.totalScore,
        "Liste à placer",
        sessionToPlace.title,
        dayObj?.label || "Jour",
        slot,
        Boolean(conflict),
      );
      setSimulationImpact(impact);
      toast.info("Impact de la simulation calculé en direct.");
      return;
    }

    setUnplaced((prev) => prev.filter((s) => s.id !== sessionToPlace.id));
    setScheduled((prev) => {
      const filtered = prev.filter((s) => !(s.day === day && s.slot === slot));
      const newScheduled: ScheduledSession = {
        id: `sched-${Date.now()}`,
        kind: sessionToPlace.kind,
        title: sessionToPlace.title,
        teacher: sessionToPlace.teacher,
        room: sessionToPlace.room,
        day,
        slot,
        group: selectedGroup,
      };
      return [...filtered, newScheduled];
    });
    setActiveDraggingId(null);
    setHighlightTarget(null);
    toast.success(`Séance « ${sessionToPlace.title} » placée le ${currentWeek.days.find((d) => d.id === day)?.label} à ${slot}.`);
  };

  /** Active une cellule libre (clic ou clavier) : dépose la séance en cours, si l'admin est en mode groupe. */
  const activateFreeCell = (day: DayId, slot: TimeSlotId) => {
    if (isAdmin && isGroupMode && activeDraggingId) {
      const sess = unplaced.find((u) => u.id === activeDraggingId);
      if (sess) handlePlaceSession(sess, day, slot);
    } else if (isAdmin && isGroupMode) {
      toast.info("Sélectionnez d'abord une séance dans la colonne de gauche.");
    }
  };

  const handleRemoveScheduledSession = (session: ScheduledSession) => {
    if (!isAdmin) return;
    setScheduled((prev) => prev.filter((s) => s.id !== session.id));
    setUnplaced((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        kind: session.kind,
        title: session.title,
        teacher: session.teacher,
        room: session.room,
        duration: "1 h 30",
        group: selectedGroup,
      },
    ]);
    toast.info(`Séance « ${session.title} » replacée dans la liste à placer.`);
  };

  const handleAutoGenerate = () => {
    if (!isAdmin) return;
    if (unplaced.length === 0) {
      toast.info("Toutes les séances de ce groupe sont déjà réparties de façon optimale !");
      return;
    }
    const availableSlots: { day: DayId; slot: TimeSlotId }[] = [];
    currentWeek.days.forEach((d) => {
      TIME_SLOTS.forEach((ts) => {
        const isOccupied = scheduled.some((s) => s.day === d.id && s.slot === ts.id);
        const hasConflict = conflicts.some((c) => c.day === d.id && c.slot === ts.id);
        if (!isOccupied && !hasConflict) {
          availableSlots.push({ day: d.id, slot: ts.id });
        }
      });
    });
    if (availableSlots.length === 0) {
      toast.error("Aucun créneau libre disponible dans la grille pour ce groupe !");
      return;
    }
    const newPlaced: ScheduledSession[] = [];
    const remainingUnplaced = [...unplaced];
    while (remainingUnplaced.length > 0 && availableSlots.length > 0) {
      const sess = remainingUnplaced.shift()!;
      const slot = availableSlots.shift()!;
      newPlaced.push({
        id: `auto-${Date.now()}-${sess.id}`,
        kind: sess.kind,
        title: sess.title,
        teacher: sess.teacher,
        room: sess.room,
        day: slot.day,
        slot: slot.slot,
        group: selectedGroup,
      });
    }
    setScheduled((prev) => [...prev, ...newPlaced]);
    setUnplaced(remainingUnplaced);
    setActiveDraggingId(null);
    setHighlightTarget(null);
    setVersionNumber((v) => v + 1);
    toast.success(
      `Planification Timefold optimale : ${newPlaced.length} séance(s) placée(s) automatiquement avec score ${qualityScore.totalScore}/100.`,
    );
  };

  const handleValidateDraft = () => {
    if (!isAdmin) return;
    setPublicationCycle("valide");
    toast.success(`Brouillon validé pour le groupe ${selectedGroup}.`);
  };

  const handlePublish = () => {
    if (!isAdmin) return;
    setPublicationCycle("publie");
    toast.success(`Emploi du temps officiel publié pour le groupe ${selectedGroup} (${currentWeek.label}) !`);
  };

  const handleResetToDefault = () => {
    if (!isAdmin) return;
    setScheduled(groupBaseData.scheduled);
    setUnplaced(groupBaseData.unplaced);
    setActiveDraggingId(null);
    setHighlightTarget(null);
    setPublicationCycle("brouillon");
    setVersionNumber(3);
    setSimulationImpact(null);
    localStorage.removeItem(storageScheduleKey);
    localStorage.removeItem(storageUnplacedKey);
    toast.info(`Emploi du temps de ${selectedGroup} réinitialisé.`);
  };

  // Titre de la page selon la vue et le rôle
  const pageTitle = useMemo(() => {
    if (isStudent) return `Mon emploi du temps · Classe 4INFO-B`;
    if (viewMode === "group") return `Emploi du temps · Groupe ${selectedGroup}`;
    if (viewMode === "teacher") return `Emploi du temps · ${selectedTeacher}`;
    return `Emploi du temps · Salle ${selectedRoom}`;
  }, [isStudent, viewMode, selectedGroup, selectedTeacher, selectedRoom]);

  const isGroupMode = viewMode === "group";

  return (
    <div className="space-y-4">
      {/* ─── BANDEAU DE SIMULATION EN COURS (« ET SI ? ») ────────────────────── */}
      {isAdmin && simulationActive && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs animate-pulse">
              <Sliders className="size-4" />
            </span>
            <div>
              <span className="font-bold text-xs text-amber-900 block">Mode Simulation (« Et si ? ») actif</span>
              <span className="text-3xs text-amber-700">
                Vous pouvez tester des déplacements de séances sans modifier l'emploi du temps officiel.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {simulationImpact && (
              <div className="text-xs font-bold text-amber-900 bg-white/80 px-2.5 py-1 rounded-md border border-amber-200">
                Score : {simulationImpact.oldScore} → {simulationImpact.newScore} ({simulationImpact.delta > 0 ? "+" : ""}
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
              className="h-8 text-xs bg-white text-slate-800"
            >
              Quitter la simulation
            </Button>
          </div>
        </div>
      )}

      {/* ─── EN-TÊTE DE LA PAGE ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{pageTitle}</h1>

            {/* Badge de statut */}
            {isAdmin ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border font-semibold text-xs px-2.5 py-0.5",
                  publicationCycle === "brouillon" && "bg-amber-50 border-amber-300 text-amber-800",
                  publicationCycle === "valide" && "bg-blue-50 border-blue-300 text-blue-800",
                  publicationCycle === "publie" && "bg-emerald-50 border-emerald-300 text-emerald-800",
                )}
              >
                {publicationCycle === "brouillon" && `Brouillon · version ${versionNumber}`}
                {publicationCycle === "valide" && `Validé · version ${versionNumber}`}
                {publicationCycle === "publie" && "Publié officiel"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold text-xs px-2.5 py-0.5">
                Emploi du temps officiel
              </span>
            )}

            {/* Badge Score Timefold / OR-Tools pour l'administrateur */}
            {isAdmin && (
              <button
                onClick={() => setQualityModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/90 px-3 py-0.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                title="Cliquer pour analyser les contraintes dures et souples"
              >
                <Sparkles className="size-3.5 text-indigo-600" />
                Score Timefold : {qualityScore.totalScore}/100
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{currentWeek.dateSubtitle}</p>
        </div>

        {/* Boutons d'action : UNIQUEMENT pour l'administrateur */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Outil Replanifier un imprévu */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleModalOpen(true)}
              className="text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100/70 text-amber-900 shadow-2xs"
            >
              <Zap className="mr-1.5 size-3.5 text-amber-600" />
              Replanifier un imprévu
            </Button>

            {/* Switch Mode Simulation */}
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
              <Sliders className="mr-1.5 size-3.5" />
              Simulation (« Et si ? »)
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800"
              title="Réinitialiser"
            >
              <RotateCcw className="mr-1 size-3.5" />
              Réinitialiser
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoGenerate}
              disabled={unplaced.length === 0 || !isGroupMode}
              className="text-xs font-semibold border-slate-300 bg-white hover:bg-slate-50 shadow-2xs"
            >
              <Sparkles className="mr-1.5 size-3.5 text-indigo-600" />
              Générer automatiquement
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleValidateDraft}
              disabled={publicationCycle !== "brouillon"}
              className="text-xs font-semibold border-slate-300 bg-white hover:bg-slate-50 shadow-2xs"
            >
              <FileCheck className="mr-1.5 size-3.5 text-slate-600" />
              Valider le brouillon
            </Button>

            <Button
              size="sm"
              onClick={handlePublish}
              className="text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-2xs px-4"
            >
              <Send className="mr-1.5 size-3.5" />
              Publier
            </Button>
          </div>
        )}
      </div>

      {/* ─── BARRE DE FILTRES : SÉLECTEURS + LÉGENDE ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50/70 p-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Vue : uniquement pour admin ou enseignant */}
          {!isStudent && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                onClick={() => setViewMode("group")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "group" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Users className="size-3.5" />
                Groupe
              </button>
              <button
                onClick={() => setViewMode("teacher")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "teacher" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <User className="size-3.5" />
                Enseignant
              </button>
              {isAdmin && (
                <button
                  onClick={() => setViewMode("room")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                    viewMode === "room" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Building2 className="size-3.5" />
                  Salle
                </button>
              )}
            </div>
          )}

          {/* Sélecteur de groupe */}
          {!isStudent && viewMode === "group" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Groupe</span>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="h-8 rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {AVAILABLE_GROUPS.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          {/* Pour l'étudiant : affichage direct de sa classe */}
          {isStudent && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-white px-3 py-1.5 rounded-md border border-slate-200">
              <span className="text-slate-400 font-normal">Classe :</span>
              <span className="text-blue-700">4INFO-B</span>
            </div>
          )}

          {/* Sélecteur enseignant */}
          {viewMode === "teacher" && !isStudent && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Enseignant</span>
              <div className="relative">
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="h-8 rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {ALL_TEACHERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          {/* Sélecteur salle (admin) */}
          {isAdmin && viewMode === "room" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Salle</span>
              <div className="relative">
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="h-8 rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {ALL_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          {/* Semaine */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Semaine</span>
            <div className="relative">
              <select
                value={selectedWeekKey}
                onChange={(e) => handleWeekChange(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(WEEKS_DATA).map(([key, w]) => (
                  <option key={key} value={key}>
                    {w.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Légende couleurs */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue-500" />
            <span>Cours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            <span>TD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-500" />
            <span>TP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-purple-500" />
            <span>Examen</span>
          </div>
        </div>
      </div>

      {/* ─── DISPOSITION PRINCIPALE ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ═══ COLONNE GAUCHE ADMIN : uniquement pour l'admin en vue groupe ═══ */}
        {isAdmin && isGroupMode && (
          <div className="lg:col-span-3 space-y-4">
            {/* CARD 1 : SÉANCES À PLACER */}
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-slate-900">Séances à placer</CardTitle>
                <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 border text-xs px-2 py-0.5 font-bold">
                  {unplaced.length}
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2.5">
                {unplaced.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-1.5" />
                    Toutes les séances de {selectedGroup} sont placées dans la grille.
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
                          "rounded-xl border p-3 text-xs transition-all cursor-grab active:cursor-grabbing select-none",
                          isSelected
                            ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-300 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold tracking-wide text-3xs uppercase text-amber-800">
                            {isSelected ? `${item.kind} · EN COURS DE DÉPLACEMENT` : item.kind}
                          </span>
                          {isSelected && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}
                        </div>
                        <h4 className="mt-1 font-bold text-slate-900 text-sm">{item.title}</h4>
                        <p className="mt-1 text-3xs font-medium text-slate-500">
                          {item.teacher} · {item.room} · {item.duration}
                        </p>
                      </div>
                    );
                  })
                )}
                {unplaced.length > 0 && (
                  <p className="text-3xs text-slate-400 italic pt-1">
                    Glisse une séance sur un créneau vert de la grille (ou clique dessus puis sur le créneau).
                  </p>
                )}
              </CardContent>
            </Card>

            {/* CARD 2 : CONTRÔLES TIMEFOLD */}
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>Contrôles du Solveur</span>
                  <span className="text-3xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {qualityScore.totalScore}/100
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3 text-xs">
                <div className="flex items-start gap-2 text-emerald-700">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <span className="font-semibold text-slate-800">
                    {conflicts.length === 0
                      ? "Contraintes dures respectées (0 conflit)"
                      : `${conflicts.length} conflit(s) dur(s) détecté(s)`}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-amber-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                  <span className="text-3xs leading-relaxed text-slate-600">
                    <strong className="text-amber-800">Contraintes souples :</strong> {qualityScore.breakdown.holesCount} trou(s),{" "}
                    {qualityScore.breakdown.teacherPreferencesMatched}% préférences profs respectées.
                  </span>
                </div>
                <div className="pt-2 border-t space-y-1.5">
                  <div className="flex items-center justify-between text-3xs font-semibold">
                    <span className="text-slate-600">Charge horaire du groupe</span>
                    <span className="text-slate-900">
                      {totalHours} h / {maxHours} h
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", totalHours >= 20 ? "bg-amber-500" : "bg-blue-600")}
                      style={{ width: `${Math.min(100, (totalHours / maxHours) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD 3 : CYCLE DE PUBLICATION */}
            <Card className="shadow-xs border-slate-200">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900">Cycle de publication</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2 text-xs">
                <label className="flex items-center gap-2.5 font-medium cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "brouillon"}
                    onChange={() => setPublicationCycle("brouillon")}
                    className="text-blue-600 focus:ring-blue-500 size-3.5"
                  />
                  <span>Brouillon</span>
                </label>
                <label className="flex items-center gap-2.5 font-medium cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "valide"}
                    onChange={() => setPublicationCycle("valide")}
                    className="text-blue-600 focus:ring-blue-500 size-3.5"
                  />
                  <span>Validé</span>
                </label>
                <label className="flex items-center gap-2.5 font-medium cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="cycle"
                    checked={publicationCycle === "publie"}
                    onChange={() => setPublicationCycle("publie")}
                    className="text-blue-600 focus:ring-blue-500 size-3.5"
                  />
                  <span>Publié</span>
                </label>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ COLONNE DROITE : GRILLE DE L'EMPLOI DU TEMPS ═══ */}
        <div className={cn(isAdmin && isGroupMode ? "lg:col-span-9" : "lg:col-span-12")}>
          <Card className="shadow-xs border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                {/* En-tête : Jours */}
                <thead>
                  <tr className="border-b bg-slate-50/70 text-xs font-bold text-slate-800">
                    <th className="w-20 p-3 text-center text-slate-400 font-semibold border-r">Créneau</th>
                    {currentWeek.days.map((day) => (
                      <th key={day.id} className="p-3 text-center border-r last:border-r-0 min-w-[155px]">
                        <span>{day.label}</span> <span className="text-slate-400 font-normal">{day.dateNum}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Corps de la grille */}
                <tbody className="divide-y divide-slate-100">
                  {TIME_SLOTS.map((slot) => (
                    <tr key={slot.id} className="h-28">
                      {/* Colonne des heures */}
                      <td className="p-2 text-center text-xs font-semibold text-slate-600 border-r bg-slate-50/30 align-middle">
                        <div className="text-3xs text-slate-700 font-bold">{slot.start}</div>
                        <div className="text-3xs text-slate-400">{slot.end}</div>
                      </td>

                      {/* Cellules des 5 jours */}
                      {currentWeek.days.map((day) => {
                        const session = displayedSessions.find((s) => s.day === day.id && s.slot === slot.id);
                        const conflict = isAdmin && isGroupMode ? conflicts.find((c) => c.day === day.id && c.slot === slot.id) : undefined;
                        const isTarget = highlightTarget?.day === day.id && highlightTarget?.slot === slot.id;

                        return (
                          <td
                            key={`${day.id}-${slot.id}`}
                            className="p-1.5 border-r last:border-r-0 align-top"
                            onDragOver={(e) => {
                              if (isAdmin && isGroupMode && !conflict && !session) {
                                e.preventDefault();
                              }
                            }}
                            onDrop={() => {
                              if (isAdmin && isGroupMode && activeDraggingId) {
                                const sess = unplaced.find((u) => u.id === activeDraggingId);
                                if (sess) handlePlaceSession(sess, day.id, slot.id);
                              }
                            }}
                          >
                            {/* CASE 1 : CONFLIT */}
                            {conflict ? (
                              <div className="flex h-full min-h-[96px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-rose-300 bg-rose-50/80 p-2 text-center text-rose-700 shadow-2xs">
                                <X className="size-4 text-rose-600 mb-0.5" />
                                <span className="text-3xs font-bold leading-tight">{conflict.reason}</span>
                              </div>
                            ) : session ? (
                              /* CASE 2 : SÉANCE PLANIFIÉE */
                              <div
                                className={cn(
                                  "group relative flex h-full min-h-[96px] w-full flex-col justify-between rounded-xl border p-2.5 transition-all shadow-2xs",
                                  KIND_COLORS[session.kind].bg,
                                  KIND_COLORS[session.kind].border,
                                  isTarget && "ring-2 ring-blue-500 border-blue-400",
                                )}
                              >
                                {isAdmin && isGroupMode && (
                                  <button
                                    onClick={() => handleRemoveScheduledSession(session)}
                                    title="Retirer cette séance"
                                    className="absolute right-1.5 top-1.5 hidden rounded-md p-0.5 text-slate-400 hover:bg-black/10 hover:text-rose-600 group-hover:block transition-colors"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}

                                <div>
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={cn(
                                        "text-3xs font-extrabold uppercase tracking-wide",
                                        session.kind === "COURS" && "text-blue-700",
                                        session.kind === "TD" && "text-emerald-700",
                                        session.kind === "TP" && "text-amber-800",
                                        session.kind === "EXAMEN" && "text-purple-700",
                                      )}
                                    >
                                      {session.statusLabel && isAdmin ? `${session.kind} · ${session.statusLabel}` : session.kind}
                                    </span>

                                    {/* En vue enseignant/salle : afficher le groupe */}
                                    {(!isGroupMode || !isStudent) && session.group && (
                                      <span className="text-3xs font-bold text-slate-500 bg-white/70 rounded px-1.5 py-0.2 border border-slate-200">
                                        {session.group}
                                      </span>
                                    )}
                                  </div>

                                  <h5 className={cn("mt-1 font-bold text-xs leading-snug", KIND_COLORS[session.kind].text)}>
                                    {session.title}
                                  </h5>
                                </div>

                                <div className="mt-1 flex items-center justify-between text-3xs font-medium text-slate-600">
                                  <span>{session.teacher}</span>

                                  {/* Clic sur la salle pour ouvrir la suggestion intelligente (admin) */}
                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTargetSessionForRoom(session);
                                        setRoomModalOpen(true);
                                      }}
                                      className="font-bold underline decoration-dotted text-blue-700 hover:text-blue-900 ml-1"
                                      title="Cliquer pour changer de salle avec suggestion intelligente"
                                    >
                                      {session.room}
                                    </button>
                                  ) : (
                                    <span className="font-semibold">{session.room}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* CASE 3 : CRÉNEAU LIBRE */
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => activateFreeCell(day.id, slot.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    activateFreeCell(day.id, slot.id);
                                  }
                                }}
                                className={cn(
                                  "flex h-full min-h-[96px] w-full flex-col items-center justify-center rounded-xl transition-all select-none",
                                  isAdmin && isGroupMode
                                    ? "border border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-100/60 hover:border-emerald-400 cursor-pointer text-emerald-700 font-semibold text-xs"
                                    : "border border-slate-100 bg-slate-50/40 text-slate-300 text-xs font-medium",
                                )}
                              >
                                <span className={cn(isAdmin && isGroupMode ? "text-emerald-700" : "text-slate-400")}>Libre</span>
                                {isAdmin && isGroupMode && activeDraggingId && (
                                  <span className="text-3xs font-normal text-emerald-600 mt-0.5">Cliquer pour déposer</span>
                                )}
                              </div>
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
        </div>
      </div>

      {/* ─── MODAL 1 : ANALYSE TIMEFOLD / OR-TOOLS (SCORE DE QUALITÉ) ──────────── */}
      <Dialog open={qualityModalOpen} onOpenChange={setQualityModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-600" />
            <span>Score de Qualité Timefold Solver (OR-Tools)</span>
          </DialogTitle>
          <DialogDescription>Analyse mathématique multicritère de l'emploi du temps du groupe {selectedGroup}.</DialogDescription>

          <div className="space-y-4 pt-2">
            {/* Score global */}
            <div className="flex items-center justify-between rounded-xl bg-indigo-50/70 border border-indigo-200 p-4">
              <div>
                <span className="text-3xs font-extrabold uppercase text-indigo-700">Score global d'optimisation</span>
                <div className="text-3xl font-black text-indigo-900 mt-0.5">{qualityScore.totalScore} / 100</div>
              </div>
              <div className="text-right text-xs">
                <span className="font-bold text-emerald-700 block">✓ Contraintes dures : {qualityScore.hardScore}%</span>
                <span className="font-bold text-blue-700 block mt-0.5">~ Contraintes souples : {qualityScore.softScore}%</span>
              </div>
            </div>

            {/* Détails des contraintes */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-slate-900">Détail des contraintes :</h4>

              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <strong>Contraintes dures (Hard) :</strong> 0 conflit enseignant & salle
                </span>
                <span className="font-bold text-emerald-700">Respecté (100%)</span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-600" />
                  <strong>Minimisation des trous :</strong> {qualityScore.breakdown.holesCount} trou(s) détecté(s)
                </span>
                <span className={qualityScore.breakdown.holesCount === 0 ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                  {qualityScore.breakdown.holesCount === 0 ? "Idéal (0 trou)" : `Pénalité (-${qualityScore.breakdown.holesCount * 8} pts)`}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  <strong>Préférences enseignants :</strong> créneaux matinaux vs après-midi
                </span>
                <span className="font-bold text-blue-700">{qualityScore.breakdown.teacherPreferencesMatched}% conformité</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
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
            <Zap className="size-5 text-amber-600" />
            <span>Replanification d'Imprévu (Rattrapage Intelligent)</span>
          </DialogTitle>
          <DialogDescription>
            Le système détecte les créneaux libres sans aucun conflit d'enseignant ni de salle et propose 3 solutions optimales.
          </DialogDescription>

          <div className="space-y-4 pt-1">
            {/* Nature de l'imprévu */}
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUnforeseenReason("teacher_absent")}
                className={cn(
                  "p-2.5 rounded-lg border text-center transition-all",
                  unforeseenReason === "teacher_absent"
                    ? "border-amber-500 bg-amber-50 text-amber-900 font-bold"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                Enseignant absent / indisponible
              </button>
              <button
                type="button"
                onClick={() => setUnforeseenReason("room_unavailable")}
                className={cn(
                  "p-2.5 rounded-lg border text-center transition-all",
                  unforeseenReason === "room_unavailable"
                    ? "border-amber-500 bg-amber-50 text-amber-900 font-bold"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                Salle indisponible / fermée
              </button>
            </div>

            {/* Sélection de la séance à rattraper */}
            <div>
              <label htmlFor="reschedule-session" className="text-xs font-bold text-slate-800 block mb-1">
                Séance à replanifier :
              </label>
              <select
                id="reschedule-session"
                value={selectedSessionToRescheduleId}
                onChange={(e) => setSelectedSessionToRescheduleId(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs"
              >
                <option value="">-- Choisir la séance impactée ({scheduled.length} séances) --</option>
                {scheduled.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.kind}) · {s.teacher} · {currentWeek.days.find((d) => d.id === s.day)?.label} à {s.slot}
                  </option>
                ))}
              </select>
            </div>

            {/* 3 Propositions de rattrapage optimales calculées par l'algorithme */}
            {selectedSessionToRescheduleId && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-xs font-extrabold text-slate-900 block">3 créneaux de rattrapage proposés sans aucun conflit :</span>

                {rescheduleOptions.map((opt, idx) => (
                  <div
                    key={opt.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-amber-300 bg-white hover:bg-amber-50/40 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-slate-900 text-white font-black text-3xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-slate-900">
                          {opt.dayLabel} {opt.dateNum} nov. · {opt.slot}
                        </span>
                        <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-3xs font-extrabold">
                          {opt.pedagogicalQuality}
                        </span>
                      </div>
                      <p className="text-3xs text-slate-500 mt-1">
                        Salle libre suggérée : <strong>{opt.room}</strong> · {opt.explanation}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleApplyReschedule(opt)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-3xs font-bold h-8 px-3"
                    >
                      Rattraper
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setRescheduleModalOpen(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 3 : SUGGESTION INTELLIGENTE DE SALLES LIBRES ───────────────── */}
      <Dialog open={roomModalOpen} onOpenChange={setRoomModalOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" />
            <span>Suggestion de Salles Libres & Adaptées</span>
          </DialogTitle>
          <DialogDescription>
            Salles recommandées pour « {targetSessionForRoom?.title} » ({targetSessionForRoom?.kind}) sur le créneau choisi.
          </DialogDescription>

          <div className="space-y-2.5 pt-2 max-h-72 overflow-y-auto divide-y divide-slate-100">
            {smartRoomSuggestions.map((sug) => (
              <div
                key={sug.room.name}
                className={cn(
                  "p-2.5 flex items-center justify-between text-xs transition-colors rounded-lg",
                  sug.isRecommended ? "bg-blue-50/70 border border-blue-200" : "hover:bg-slate-50",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{sug.room.name}</span>
                    <span className="text-3xs font-semibold text-slate-400">
                      ({sug.room.type} · {sug.room.capacity} pl.)
                    </span>
                    {sug.isRecommended && (
                      <span className="rounded bg-blue-600 text-white px-1.5 py-0.2 text-3xs font-extrabold uppercase">Recommandée</span>
                    )}
                  </div>
                  <span className="text-3xs text-slate-500 block mt-0.5">{sug.reason}</span>
                </div>

                <div>
                  {sug.isAvailable ? (
                    <Button
                      size="sm"
                      onClick={() => handleApplyRoom(sug.room.name)}
                      className="h-7 text-3xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Affecter
                    </Button>
                  ) : (
                    <span className="text-3xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">Occupée</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setRoomModalOpen(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
