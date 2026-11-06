import type { Role } from "@/shared/auth/roles";
import { ROLES } from "@/shared/auth/roles";
import { normalize } from "@/shared/lib/format";
import { INSTITUTIONAL_DOMAIN, MAX_ATTEMPTS } from "../utils/validation";
import type { AccountStatus, LoginEvent, PermissionDef, PermissionMatrix, UserAccount } from "../types";

/** Mot de passe de tous les comptes fictifs (affiché sur la page de connexion en mode démo). */
export const DEMO_PASSWORD = "Campus2026!";

const NOW = new Date("2026-10-11T09:30:00+01:00").getTime();
const H = 3_600_000;
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString();

const emailOf = (first: string, last: string) =>
  `${normalize(first)}.${normalize(last)}`.replace(/[\s']/g, "") + `@${INSTITUTIONAL_DOMAIN}`;

function mk(
  id: string,
  firstName: string,
  lastName: string,
  role: Role,
  opts: { status?: AccountStatus; failed?: number; created?: number; last?: number | null; phone?: string; email?: string } = {},
): UserAccount {
  return {
    id,
    firstName,
    lastName,
    role,
    email: opts.email ?? emailOf(firstName, lastName),
    phone: opts.phone,
    status: opts.status ?? "active",
    failedAttempts: opts.failed ?? (opts.status === "suspended" ? MAX_ATTEMPTS : 0),
    createdAt: iso(opts.created ?? 24 * 300),
    lastLoginAt: opts.last === null ? null : iso(opts.last ?? 5),
  };
}

// Les 7 premiers comptes correspondent aux utilisateurs du sélecteur de rôle (DEMO_USERS).
const seedUsers = (): UserAccount[] => [
  mk("ETU-2024-0187", "Yasmine", "Ben Salah", "student", { last: 2, created: 24 * 380, phone: "+216 22 345 678" }),
  mk("ENS-0042", "Karim", "Trabelsi", "teacher", { last: 4, created: 24 * 900, phone: "+216 98 112 004" }),
  mk("ADM-0001", "Sonia", "Gharbi", "admin", { last: 1, created: 24 * 1400, phone: "+216 71 000 111" }),
  mk("ETU-2023-0956", "Lina", "Haddad", "student", { last: 7, created: 24 * 700, phone: "+216 55 908 231" }),
  mk("ETU-2024-0211", "Amine", "Khelifi", "student", { last: 3, created: 24 * 380 }),
  mk("ETU-2024-0302", "Inès", "Bouzid", "student", { last: 12, created: 24 * 380 }),
  mk("ETU-2023-0644", "Omar", "Dridi", "student", { last: 70, created: 24 * 700 }),
  mk("ETU-2025-0019", "Rim", "Zouari", "student", { last: 6, created: 24 * 20 }),
  mk("ETU-2024-0455", "Mariem", "Sfaxi", "student", { last: 22, created: 24 * 380 }),
  mk("ETU-2022-0832", "Walid", "Chaabane", "student", { status: "inactive", last: 24 * 90, created: 24 * 1000 }),
  mk("ETU-2024-0577", "Hajer", "Mejri", "student", { status: "suspended", last: 3, created: 24 * 380 }),
  mk("ETU-2025-0101", "Skander", "Ouertani", "student", { last: 9, created: 24 * 25 }),
  mk("ETU-2023-0770", "Fatma", "Ben Amor", "student", { last: 48, created: 24 * 700 }),
  mk("ETU-2025-0233", "Chaïma", "Hamdi", "student", { failed: 3, last: 15, created: 24 * 22 }),
  mk("ETU-2023-0958", "Youssef", "Karray", "student", { last: 8, created: 24 * 700 }),
  mk("ENS-0017", "Salma", "Ayari", "teacher", { last: 5, created: 24 * 1200 }),
  mk("ENS-0031", "Hichem", "Belhaj", "teacher", { last: 29, created: 24 * 1000 }),
  mk("ENS-0056", "Rania", "Mokni", "teacher", { status: "inactive", last: 24 * 160, created: 24 * 800 }),
  mk("ENS-0063", "Marc", "Dubois", "teacher", { last: 100, created: 24 * 400 }),
  mk("ADM-0004", "Tarek", "Bouaziz", "admin", { last: 20, created: 24 * 1300 }),
  // Compte administrateur personnel pour les essais (mot de passe : DEMO_PASSWORD).
  mk("ADM-0009", "Fara", "Yaich", "admin", { last: 1, created: 24 * 30, email: "yaichfara1@gmail.com" }),
];

export const PERMISSIONS: PermissionDef[] = [
  { key: "users.manage", label: "Gérer les comptes utilisateurs", group: "Utilisateurs" },
  { key: "users.roles", label: "Modifier les rôles et permissions", group: "Utilisateurs" },
  { key: "academic.view", label: "Consulter le parcours académique", group: "Académique" },
  { key: "academic.manage", label: "Créer et gérer les cours, affecter les enseignants", group: "Académique" },
  { key: "academic.grades", label: "Saisir et publier les notes", group: "Académique" },
  { key: "resources.book", label: "Réserver une salle ou un équipement", group: "Ressources" },
  { key: "resources.manage", label: "Gérer les salles, valider les réservations et la maintenance", group: "Ressources" },
  { key: "housing.request", label: "Déposer une demande d'hébergement", group: "Résidences" },
  { key: "housing.assign", label: "Affecter les chambres", group: "Résidences" },
  { key: "clubs.join", label: "Adhérer aux clubs et événements", group: "Vie étudiante" },
  { key: "clubs.manage", label: "Gérer les clubs et leurs événements", group: "Vie étudiante" },
  { key: "library.borrow", label: "Emprunter et réserver des ouvrages", group: "Bibliothèque" },
  { key: "library.manage", label: "Gérer le catalogue et les prêts", group: "Bibliothèque" },
];

const GRANTS: Record<Role, string[]> = {
  student: ["academic.view", "housing.request", "library.borrow", "resources.book", "clubs.join"],
  teacher: ["academic.view", "academic.grades", "resources.book", "library.borrow", "clubs.join"],
  admin: PERMISSIONS.map((p) => p.key),
};

const buildMatrix = (): PermissionMatrix["matrix"] =>
  Object.fromEntries(
    ROLES.map((r) => [r, Object.fromEntries(PERMISSIONS.map((p) => [p.key, GRANTS[r].includes(p.key)]))]),
  ) as PermissionMatrix["matrix"];

const DEVICES = [
  "Chrome 130 · Windows 11",
  "Safari 18 · iPhone",
  "Firefox 131 · Ubuntu",
  "Edge 130 · Windows 10",
  "Application mobile · Android 15",
  "Chrome 130 · macOS",
];
const IPS = ["41.226.12.", "197.27.54.", "196.203.9.", "41.62.101.", "160.159.33."];

/** Historique déterministe (pseudo-aléatoire figé) : ~4 connexions par compte, échecs récents pour les comptes suspendus. */
function seedHistory(users: UserAccount[]): LoginEvent[] {
  const events: LoginEvent[] = [];
  let n = 0;
  users.forEach((u, i) => {
    const count = 3 + (i % 3);
    for (let k = 0; k < count; k++) {
      const hoursAgo = (u.lastLoginAt ? (NOW - new Date(u.lastLoginAt).getTime()) / H : 24) + k * (17 + ((i * 7) % 23));
      events.push({
        id: `h-${++n}`,
        userId: u.id,
        userName: `${u.firstName} ${u.lastName}`,
        date: iso(hoursAgo),
        ip: `${IPS[(i + k) % IPS.length]}${10 + ((i * 13 + k * 29) % 200)}`,
        device: DEVICES[(i * 3 + k) % DEVICES.length]!,
        success: !(k === 2 && i % 5 === 0),
      });
    }
    if (u.status === "suspended" || u.failedAttempts > 0) {
      for (let f = 0; f < u.failedAttempts; f++) {
        events.push({
          id: `h-${++n}`,
          userId: u.id,
          userName: `${u.firstName} ${u.lastName}`,
          date: iso(2 + (u.failedAttempts - f) * 0.1),
          ip: `${IPS[i % IPS.length]}${40 + i}`,
          device: DEVICES[i % DEVICES.length]!,
          success: false,
        });
      }
    }
  });
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

const AVATAR_KEY = "smartcampus.avatars";

function readAvatars(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(AVATAR_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Photo enregistrée pour un utilisateur (conservée dans le navigateur en mode démo). */
export const storedAvatar = (userId: string): string | undefined => readAvatars()[userId];

/** Enregistre ou supprime (url absente) la photo d'un utilisateur. */
export function saveAvatar(userId: string, url?: string) {
  const all = readAvatars();
  if (url) all[userId] = url;
  else delete all[userId];
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(all));
  } catch {
    /* stockage indisponible ou plein : la photo reste en mémoire pour cette session */
  }
}

const users = seedUsers();
users.forEach((u) => {
  const url = storedAvatar(u.id);
  if (url) u.avatarUrl = url;
});

/** « Base de données » en mémoire du user-service fictif : reste cohérente pendant toute la session. */
export const db = {
  users,
  passwords: new Map<string, string>(),
  permissions: buildMatrix(),
  history: seedHistory(users),
  seq: 300,
  now: () => new Date().toISOString(),
};
export const DEMO_CODE = "123456";
