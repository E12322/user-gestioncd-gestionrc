import { useState, useMemo } from "react";
import { Building2, Users, Clock, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

// ─── DONNÉES STATISTIQUES ET PILOTAGE DU CAMPUS ──────────────────────────────

interface RoomOccupancyData {
  roomName: string;
  type: string;
  capacity: number;
  // Nombre de créneaux occupés sur 20 créneaux hebdomadaires (5 jours x 4 créneaux)
  occupiedSlots: number;
  totalSlots: number;
  // Taux par jour
  byDay: { [day: string]: number }; // ex: { "Lundi": 3, "Mardi": 4, ... }
}

const INITIAL_ROOM_OCCUPANCY: RoomOccupancyData[] = [
  {
    roomName: "Amphi A",
    type: "Amphi",
    capacity: 150,
    occupiedSlots: 14,
    totalSlots: 20,
    byDay: { Lundi: 3, Mardi: 3, Mercredi: 3, Jeudi: 2, Vendredi: 3 },
  },
  {
    roomName: "Amphi B",
    type: "Amphi",
    capacity: 120,
    occupiedSlots: 15,
    totalSlots: 20,
    byDay: { Lundi: 4, Mardi: 3, Mercredi: 2, Jeudi: 3, Vendredi: 3 },
  },
  {
    roomName: "Amphi C",
    type: "Amphi",
    capacity: 90,
    occupiedSlots: 8,
    totalSlots: 20,
    byDay: { Lundi: 1, Mardi: 2, Mercredi: 2, Jeudi: 2, Vendredi: 1 },
  },
  {
    roomName: "Labo L1",
    type: "Labo",
    capacity: 32,
    occupiedSlots: 16,
    totalSlots: 20,
    byDay: { Lundi: 4, Mardi: 3, Mercredi: 3, Jeudi: 3, Vendredi: 3 },
  },
  {
    roomName: "Labo L2",
    type: "Labo",
    capacity: 32,
    occupiedSlots: 15,
    totalSlots: 20,
    byDay: { Lundi: 3, Mardi: 3, Mercredi: 3, Jeudi: 4, Vendredi: 2 },
  },
  {
    roomName: "Labo L3",
    type: "Labo",
    capacity: 32,
    occupiedSlots: 13,
    totalSlots: 20,
    byDay: { Lundi: 3, Mardi: 2, Mercredi: 4, Jeudi: 2, Vendredi: 2 },
  },
  {
    roomName: "Labo L4",
    type: "Labo",
    capacity: 28,
    occupiedSlots: 6,
    totalSlots: 20,
    byDay: { Lundi: 1, Mardi: 2, Mercredi: 1, Jeudi: 1, Vendredi: 1 },
  },
  {
    roomName: "B101",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 11,
    totalSlots: 20,
    byDay: { Lundi: 2, Mardi: 3, Mercredi: 2, Jeudi: 2, Vendredi: 2 },
  },
  {
    roomName: "B102",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 13,
    totalSlots: 20,
    byDay: { Lundi: 3, Mardi: 3, Mercredi: 3, Jeudi: 2, Vendredi: 2 },
  },
  {
    roomName: "B103",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 12,
    totalSlots: 20,
    byDay: { Lundi: 2, Mardi: 2, Mercredi: 3, Jeudi: 3, Vendredi: 2 },
  },
  {
    roomName: "B104",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 10,
    totalSlots: 20,
    byDay: { Lundi: 2, Mardi: 2, Mercredi: 2, Jeudi: 2, Vendredi: 2 },
  },
  {
    roomName: "B105",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 14,
    totalSlots: 20,
    byDay: { Lundi: 3, Mardi: 3, Mercredi: 3, Jeudi: 3, Vendredi: 2 },
  },
  {
    roomName: "B201",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 9,
    totalSlots: 20,
    byDay: { Lundi: 2, Mardi: 2, Mercredi: 2, Jeudi: 1, Vendredi: 2 },
  },
  {
    roomName: "B204",
    type: "Salle TD",
    capacity: 40,
    occupiedSlots: 7,
    totalSlots: 20,
    byDay: { Lundi: 1, Mardi: 1, Mercredi: 2, Jeudi: 2, Vendredi: 1 },
  },
];

interface TeacherWorkload {
  teacherName: string;
  department: string;
  assignedHours: number;
  maxWeeklyHours: number;
  coursesCount: number;
}

const TEACHERS_WORKLOAD: TeacherWorkload[] = [
  { teacherName: "Pr. Karim Trabelsi", department: "Informatique", assignedHours: 19.5, maxWeeklyHours: 20, coursesCount: 4 },
  { teacherName: "Pr. Mourad Gharbi", department: "Informatique", assignedHours: 22.5, maxWeeklyHours: 20, coursesCount: 5 }, // Alerte dépassement
  { teacherName: "Pr. Sonia Jlassi", department: "Informatique", assignedHours: 18.0, maxWeeklyHours: 20, coursesCount: 3 },
  { teacherName: "Pr. Rafik Mrad", department: "Informatique", assignedHours: 16.5, maxWeeklyHours: 20, coursesCount: 3 },
  { teacherName: "Mr. Tarek Chaabane", department: "Informatique", assignedHours: 15.0, maxWeeklyHours: 20, coursesCount: 3 },
  { teacherName: "Mr. Sami Ouni", department: "Informatique", assignedHours: 21.0, maxWeeklyHours: 20, coursesCount: 4 }, // Alerte dépassement
  { teacherName: "Mme. Rim Ayari", department: "Langues", assignedHours: 13.5, maxWeeklyHours: 20, coursesCount: 3 },
  { teacherName: "Dr. Walid Hammami", department: "Informatique", assignedHours: 12.0, maxWeeklyHours: 20, coursesCount: 2 },
  { teacherName: "Mme. Fatma Zairi", department: "Mathématiques", assignedHours: 15.0, maxWeeklyHours: 20, coursesCount: 3 },
];

interface GroupWorkload {
  groupCode: string;
  semester: string;
  weeklyHours: number;
  maxCapacityHours: number;
  holesCount: number;
  heavyDaysCount: number; // Journées à plus de 3 cours consécutifs
}

const GROUPS_WORKLOAD: GroupWorkload[] = [
  { groupCode: "4INFO-B", semester: "Semestre 1", weeklyHours: 21.0, maxCapacityHours: 24, holesCount: 1, heavyDaysCount: 1 },
  { groupCode: "4INFO-A", semester: "Semestre 1", weeklyHours: 18.0, maxCapacityHours: 24, holesCount: 0, heavyDaysCount: 0 },
  { groupCode: "4INFO-C", semester: "Semestre 1", weeklyHours: 16.5, maxCapacityHours: 24, holesCount: 1, heavyDaysCount: 0 },
  { groupCode: "3INFO-A", semester: "Semestre 1", weeklyHours: 22.5, maxCapacityHours: 24, holesCount: 0, heavyDaysCount: 1 },
  { groupCode: "3INFO-B", semester: "Semestre 1", weeklyHours: 15.0, maxCapacityHours: 24, holesCount: 2, heavyDaysCount: 0 },
  { groupCode: "2INFO-A", semester: "Semestre 1", weeklyHours: 19.5, maxCapacityHours: 24, holesCount: 0, heavyDaysCount: 0 },
];

interface CourseProgress {
  code: string;
  title: string;
  teacher: string;
  completedHours: number;
  plannedHours: number;
}

const COURSES_PROGRESS: CourseProgress[] = [
  { code: "GL-250", title: "Génie logiciel & UML", teacher: "Pr. Trabelsi", completedHours: 27, plannedHours: 42 },
  { code: "INF-301", title: "Architecture microservices", teacher: "Pr. Trabelsi", completedHours: 24, plannedHours: 36 },
  { code: "BD-220", title: "Bases de données relationnelles", teacher: "Mme Jlassi", completedHours: 21, plannedHours: 36 },
  { code: "ARCH-401", title: "Architecture logicielle avancée", teacher: "Pr. Mrad", completedHours: 18, plannedHours: 30 },
  { code: "RES-310", title: "Réseaux & Sécurité applicative", teacher: "Pr. Gharbi", completedHours: 15, plannedHours: 36 },
  { code: "DEV-205", title: "Développement React & TypeScript", teacher: "Mr Ouni", completedHours: 24, plannedHours: 36 },
  { code: "ANG-102", title: "Anglais technique professionnel", teacher: "Mme Ayari", completedHours: 12, plannedHours: 24 },
  { code: "EMB-403", title: "Systèmes embarqués IoT", teacher: "Mr Ouni", completedHours: 18, plannedHours: 30 },
];

export default function PilotagePage() {
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"occupancy" | "workloads" | "progress">("occupancy");

  // Filtrage des salles
  const filteredRooms = useMemo(() => {
    if (roomTypeFilter === "all") return INITIAL_ROOM_OCCUPANCY;
    return INITIAL_ROOM_OCCUPANCY.filter((r) => r.type === roomTypeFilter);
  }, [roomTypeFilter]);

  // Statistiques globales
  const totalOccupied = INITIAL_ROOM_OCCUPANCY.reduce((acc, r) => acc + r.occupiedSlots, 0);
  const totalAvailable = INITIAL_ROOM_OCCUPANCY.length * 20;
  const overallOccupancyRate = Math.round((totalOccupied / totalAvailable) * 100);

  const underutilizedRoomsCount = INITIAL_ROOM_OCCUPANCY.filter((r) => (r.occupiedSlots / r.totalSlots) * 100 < 45).length;

  const overloadedTeachersCount = TEACHERS_WORKLOAD.filter((t) => t.assignedHours > t.maxWeeklyHours).length;

  const totalSemesterHoursCompleted = COURSES_PROGRESS.reduce((acc, c) => acc + c.completedHours, 0);
  const totalSemesterHoursPlanned = COURSES_PROGRESS.reduce((acc, c) => acc + c.plannedHours, 0);
  const overallSemesterProgress = Math.round((totalSemesterHoursCompleted / totalSemesterHoursPlanned) * 100);

  return (
    <div className="space-y-6">
      {/* ─── EN-TÊTE DE LA PAGE PILOTAGE ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Pilotage & Statistiques de Planification</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              Tableau de bord Administrateur
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            Supervision globale des ressources du campus : occupation des salles, charges horaires, trous et avancement semestriel.
          </p>
        </div>

        {/* Boutons d'onglets de vue */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab("occupancy")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === "occupancy" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Building2 className="size-3.5" />
            Occupation des Salles
          </button>
          <button
            onClick={() => setActiveTab("workloads")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === "workloads" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Users className="size-3.5" />
            Charges & Trous
          </button>
          <button
            onClick={() => setActiveTab("progress")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === "progress" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Clock className="size-3.5" />
            Avancement des Cours
          </button>
        </div>
      </div>

      {/* ─── 4 CARTES KPIS EN HAUT ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Taux d'occupation global */}
        <Card className="border-slate-200 shadow-2xs bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wide text-slate-500">Occupation globale salles</span>
            <Building2 className="size-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overallOccupancyRate}%</span>
            <span className="text-3xs font-semibold text-emerald-600">Optimal (cible : 65-75%)</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${overallOccupancyRate}%` }} />
          </div>
        </Card>

        {/* KPI 2 : Salles sous-utilisées */}
        <Card className="border-slate-200 shadow-2xs bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wide text-slate-500">Salles sous-utilisées</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{underutilizedRoomsCount}</span>
            <span className="text-3xs font-semibold text-slate-500">sur {INITIAL_ROOM_OCCUPANCY.length} salles</span>
          </div>
          <p className="mt-2 text-3xs text-slate-500">Amphi C, Labo L4 et B204 disponibles pour replanifications.</p>
        </Card>

        {/* KPI 3 : Alertes Enseignants */}
        <Card className="border-slate-200 shadow-2xs bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wide text-slate-500">Dépassements de charge</span>
            <Users className="size-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{overloadedTeachersCount}</span>
            <span className="text-3xs font-semibold text-rose-700">enseignants &gt; 20 h/semaine</span>
          </div>
          <p className="mt-2 text-3xs text-rose-600 font-medium">Pr. Gharbi (22.5 h) et Mr. Ouni (21.0 h) en dépassement.</p>
        </Card>

        {/* KPI 4 : Avancement Semestre */}
        <Card className="border-slate-200 shadow-2xs bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold uppercase tracking-wide text-slate-500">Avancement global semestre</span>
            <Clock className="size-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overallSemesterProgress}%</span>
            <span className="text-3xs font-semibold text-slate-500">
              {totalSemesterHoursCompleted} h / {totalSemesterHoursPlanned} h
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${overallSemesterProgress}%` }} />
          </div>
        </Card>
      </div>

      {/* ─── ONGLET 1 : TAUX D'OCCUPATION DES SALLES PAR CRÉNEAU ──────────────── */}
      {activeTab === "occupancy" && (
        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="size-4 text-blue-600" />
                Matrice d'Occupation des Salles du Campus (Heatmap par Jour)
              </CardTitle>
              <p className="text-3xs text-slate-500 mt-0.5">
                Surveillance de la saturation : vert = disponible (&lt;50%), bleu = optimal (50-75%), ambre/rouge = saturée (&gt;75%).
              </p>
            </div>

            {/* Filtre de type de salle */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Type :</span>
              <select
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-2xs cursor-pointer"
              >
                <option value="all">Toutes les salles ({INITIAL_ROOM_OCCUPANCY.length})</option>
                <option value="Amphi">Amphithéâtres</option>
                <option value="Labo">Laboratoires informatiques</option>
                <option value="Salle TD">Salles de TD</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b bg-slate-50/70 text-3xs font-extrabold uppercase text-slate-500">
                  <th className="p-3">Salle</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Capacité</th>
                  <th className="p-3 text-center">Lundi</th>
                  <th className="p-3 text-center">Mardi</th>
                  <th className="p-3 text-center">Mercredi</th>
                  <th className="p-3 text-center">Jeudi</th>
                  <th className="p-3 text-center">Vendredi</th>
                  <th className="p-3 text-right">Taux Hebdo</th>
                  <th className="p-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRooms.map((r) => {
                  const rate = Math.round((r.occupiedSlots / r.totalSlots) * 100);
                  const isSaturated = rate >= 75;
                  const isUnderutilized = rate <= 45;

                  return (
                    <tr key={r.roomName} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-900">{r.roomName}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-3xs font-extrabold uppercase",
                            r.type === "Amphi" && "bg-blue-100 text-blue-800",
                            r.type === "Labo" && "bg-amber-100 text-amber-800",
                            r.type === "Salle TD" && "bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{r.capacity} places</td>

                      {/* Colonnes par jour : 4 créneaux max par jour */}
                      {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((day) => {
                        const count = r.byDay[day] || 0;
                        const dayRate = count / 4;
                        return (
                          <td key={day} className="p-3 text-center">
                            <span
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-md font-bold text-3xs shadow-2xs",
                                dayRate >= 0.75
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : dayRate >= 0.5
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200",
                              )}
                              title={`${count} créneaux occupés sur 4 le ${day}`}
                            >
                              {count}/4
                            </span>
                          </td>
                        );
                      })}

                      {/* Taux hebdomadaire */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-extrabold text-slate-900">{rate}%</span>
                          <span className="text-3xs text-slate-400">
                            ({r.occupiedSlots}/{r.totalSlots}h)
                          </span>
                        </div>
                      </td>

                      {/* Statut ergonomique */}
                      <td className="p-3 text-center">
                        {isSaturated ? (
                          <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-3xs font-bold text-rose-700">
                            Saturée
                          </span>
                        ) : isUnderutilized ? (
                          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-3xs font-bold text-amber-700">
                            Sous-utilisée
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-3xs font-bold text-emerald-700">
                            Optimale
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ─── ONGLET 2 : CHARGES HORAIRES ET DÉTECTION DES TROUS ───────────────── */}
      {activeTab === "workloads" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Colonne gauche (7 cols) : Charge Enseignants avec alerte dépassement */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-slate-200 bg-white shadow-2xs">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  Charge Hebdomadaire par Enseignant (Max recommandé : 20 h)
                </CardTitle>
                <p className="text-3xs text-slate-500 mt-0.5">Surveillance du volume horaire légal pour prévenir la fatigue pédagogique.</p>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5">
                {TEACHERS_WORKLOAD.map((t) => {
                  const isOverloaded = t.assignedHours > t.maxWeeklyHours;
                  const percent = Math.min(100, Math.round((t.assignedHours / t.maxWeeklyHours) * 100));

                  return (
                    <div key={t.teacherName} className="space-y-1.5 p-2 rounded-lg border border-slate-100 hover:bg-slate-50/50">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900">{t.teacherName}</span>{" "}
                          <span className="text-3xs text-slate-400">
                            ({t.coursesCount} cours · {t.department})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-extrabold", isOverloaded ? "text-rose-600" : "text-slate-800")}>
                            {t.assignedHours} h / {t.maxWeeklyHours} h
                          </span>
                          {isOverloaded && (
                            <span className="rounded bg-rose-100 text-rose-800 px-1.5 py-0.2 text-3xs font-extrabold">
                              Dépassement +{(t.assignedHours - t.maxWeeklyHours).toFixed(1)} h
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isOverloaded ? "bg-rose-600" : percent >= 85 ? "bg-blue-600" : "bg-emerald-600",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite (5 cols) : Charge par Groupe, Trous & Surcharges */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-slate-200 bg-white shadow-2xs">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="size-4 text-indigo-600" />
                  Qualité d'Emploi du Temps par Groupe
                </CardTitle>
                <p className="text-3xs text-slate-500 mt-0.5">
                  Détection automatique des trous et des journées surchargées (&gt; 3 cours consécutifs).
                </p>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {GROUPS_WORKLOAD.map((g) => {
                  return (
                    <div key={g.groupCode} className="rounded-xl border border-slate-200 p-3 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900">{g.groupCode}</span>
                        <span className="text-xs font-bold text-slate-700">{g.weeklyHours} h / 24 h</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-3xs">
                        {g.holesCount === 0 && g.heavyDaysCount === 0 ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="size-3.5" /> 0 trou · Planning continu optimal
                          </span>
                        ) : (
                          <>
                            {g.holesCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <AlertTriangle className="size-3" /> {g.holesCount} trou(s) détecté(s)
                              </span>
                            )}
                            {g.heavyDaysCount > 0 && (
                              <span className="flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                <AlertTriangle className="size-3" /> {g.heavyDaysCount} journée à charge continue
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── ONGLET 3 : AVANCEMENT DU SEMESTRE PAR COURS ───────────────────────── */}
      {activeTab === "progress" && (
        <Card className="border-slate-200 bg-white shadow-2xs">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="size-4 text-blue-600" />
              Avancement Pédagogique du Semestre (Heures Réalisées vs Prévues)
            </CardTitle>
            <p className="text-3xs text-slate-500 mt-0.5">
              Suivi de progression en temps réel pour anticiper les retards de programme avant les examens finaux.
            </p>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COURSES_PROGRESS.map((c) => {
                const percent = Math.round((c.completedHours / c.plannedHours) * 100);
                const remaining = c.plannedHours - c.completedHours;

                return (
                  <div key={c.code} className="rounded-xl border border-slate-200 p-4 bg-white space-y-2 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-3xs font-extrabold uppercase">
                          {c.code}
                        </span>
                        <h4 className="mt-1 font-bold text-sm text-slate-900">{c.title}</h4>
                        <p className="text-3xs text-slate-500 font-medium">Enseignant : {c.teacher}</p>
                      </div>
                      <span className="text-base font-black text-slate-900">{percent}%</span>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-3xs font-semibold text-slate-600">
                        <span>{c.completedHours} h réalisées</span>
                        <span>
                          {remaining} h restantes sur {c.plannedHours} h
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            percent >= 75 ? "bg-emerald-600" : percent >= 50 ? "bg-blue-600" : "bg-amber-500",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
