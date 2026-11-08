/** Annuaire local de démonstration : noms affichés pour les matricules connus. */
const NAMES: Record<string, string> = {
  "ETU-2024-0187": "Yasmine Ben Salah",
  "ETU-2024-0211": "Amine Khelifi",
  "ETU-2024-0302": "Inès Bouzid",
  "ETU-2023-0644": "Omar Dridi",
  "ETU-2025-0019": "Rim Zouari",
  "ETU-2024-0455": "Mariem Sfaxi",
};

/** En production, l'API Utilisateurs fournit le nom ; ici on retombe sur le matricule. */
export const studentDisplayName = (etudiantId: string) => NAMES[etudiantId] ?? etudiantId;
