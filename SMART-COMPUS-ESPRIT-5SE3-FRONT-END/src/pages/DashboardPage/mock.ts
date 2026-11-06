import type { Role } from "@/shared/auth/roles";
import type { Announcement, DashboardData, DashboardEvent } from "./types";

const announcements: Announcement[] = [
  {
    id: "a1",
    title: "Ouverture des inscriptions au semestre 2",
    body: "Les inscriptions pédagogiques sont ouvertes jusqu'au 30 novembre.",
    date: "Il y a 2 h",
    tone: "blue",
  },
  {
    id: "a2",
    title: "Maintenance du réseau Wi-Fi — Bloc B",
    body: "Coupure prévue samedi de 22 h à 2 h du matin.",
    date: "Hier",
    tone: "amber",
  },
  {
    id: "a3",
    title: "Nouveaux horaires de la bibliothèque",
    body: "Ouverture prolongée jusqu'à 21 h pendant la période d'examens.",
    date: "Il y a 3 jours",
    tone: "green",
  },
];

const events: DashboardEvent[] = [
  { id: "e1", title: "Conférence IA & Société", when: "Demain · 10:00 · Amphi A", tone: "navy" },
  { id: "e2", title: "Journée portes ouvertes des clubs", when: "Jeu. 16 oct. · 14:00", tone: "amber" },
  { id: "e3", title: "Date limite : dossier de résidence", when: "Lun. 20 oct.", tone: "red" },
  { id: "e4", title: "Hackathon SmartCampus", when: "Sam. 25 oct. · 09:00", tone: "green" },
];

const weekly = (v: number[]) => ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, i) => ({ day, value: v[i]! }));

type RoleData = Omit<DashboardData, "events" | "announcements">;

const byRole: Record<Role, RoleData> = {
  student: {
    subtitle: "Voici un aperçu de votre semestre en cours.",
    progress: { title: "Progression du semestre", value: 68, caption: "17 crédits validés sur 25" },
    kpi: { label: "Moyenne générale", value: "14,2", hint: "+0,6 vs semestre précédent" },
    quickAccess: ["academic", "housing", "student-life", "library"],
    quickActions: [
      { label: "Consulter mon emploi du temps", module: "academic" },
      { label: "Demander une chambre", module: "housing" },
      { label: "Emprunter un livre", module: "library" },
    ],
    listTitle: "Mes demandes récentes",
    items: [
      {
        id: "i1",
        title: "Demande de chambre — Les Oliviers",
        subtitle: "Déposée le 3 oct.",
        status: "pending",
        tone: "amber",
        module: "housing",
      },
      {
        id: "i2",
        title: "Adhésion au Club Robotique",
        subtitle: "Traitée le 1er oct.",
        status: "confirmed",
        tone: "green",
        module: "student-life",
      },
      {
        id: "i3",
        title: "Prêt : Clean Architecture",
        subtitle: "À rendre avant le 24 oct.",
        status: "validated",
        tone: "navy",
        module: "library",
      },
      {
        id: "i4",
        title: "Demande de rattrapage — MAT-210",
        subtitle: "Examinée le 29 sept.",
        status: "refused",
        tone: "red",
        module: "academic",
      },
    ],
    activity: weekly([4, 6, 5, 7, 3, 1]),
  },
  teacher: {
    subtitle: "Vos cours et réservations de la semaine.",
    progress: { title: "Notes saisies", value: 82, caption: "123 copies sur 150" },
    kpi: { label: "Heures d'enseignement", value: "14 h", hint: "cette semaine" },
    quickAccess: ["academic", "resources", "student-life", "library"],
    quickActions: [
      { label: "Saisir des notes", module: "academic" },
      { label: "Réserver une salle", module: "resources" },
      { label: "Proposer un projet encadré", module: "student-life" },
    ],
    listTitle: "Mes réservations de salles",
    items: [
      {
        id: "i1",
        title: "Amphi A — INF-301",
        subtitle: "Mar. 14 oct. · 10:00–12:00",
        status: "confirmed",
        tone: "green",
        module: "resources",
      },
      {
        id: "i2",
        title: "Labo Réseaux — TP",
        subtitle: "Jeu. 16 oct. · 14:00–16:00",
        status: "pending",
        tone: "amber",
        module: "resources",
      },
      {
        id: "i3",
        title: "Salle C12 — Soutenances",
        subtitle: "Ven. 24 oct. · 09:00",
        status: "validated",
        tone: "navy",
        module: "resources",
      },
    ],
    activity: weekly([3, 4, 2, 4, 1, 0]),
  },
  admin: {
    subtitle: "Supervision de la plateforme et des utilisateurs.",
    progress: { title: "Comptes activés", value: 91, caption: "3 640 sur 4 000 comptes" },
    kpi: { label: "Utilisateurs actifs", value: "2 418", hint: "+5 % cette semaine" },
    quickAccess: ["users", "academic", "resources", "housing"],
    quickActions: [
      { label: "Créer un compte", module: "users" },
      { label: "Valider les inscriptions", module: "academic" },
      { label: "Voir l'occupation des résidences", module: "housing" },
    ],
    listTitle: "Demandes à traiter",
    items: [
      {
        id: "i1",
        title: "12 comptes en attente de validation",
        subtitle: "Utilisateurs",
        status: "pending",
        tone: "amber",
        module: "users",
      },
      { id: "i2", title: "Ouverture du semestre 2", subtitle: "Académique", status: "validated", tone: "navy", module: "academic" },
      { id: "i3", title: "Conflit de réservation — Amphi A", subtitle: "Ressources", status: "refused", tone: "red", module: "resources" },
      {
        id: "i4",
        title: "Attribution des chambres — vague 1",
        subtitle: "Résidences",
        status: "confirmed",
        tone: "green",
        module: "housing",
      },
    ],
    activity: weekly([120, 180, 160, 210, 140, 40]),
  },
};

export function buildDashboard(role: Role): DashboardData {
  return { ...byRole[role], events, announcements };
}
