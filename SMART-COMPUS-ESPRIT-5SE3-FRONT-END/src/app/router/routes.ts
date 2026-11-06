/** Chemins de l'application : une seule source pour les liens, redirections et tests. */
export const ROUTES = {
  home: "/",
  login: "/connexion",
  register: "/inscription",
  verifyEmail: "/verification-email",
  forgotPassword: "/mot-de-passe-oublie",
  resetPassword: "/reinitialiser-mot-de-passe",
  changePassword: "/changer-mot-de-passe",
  profile: "/profil",
} as const;
