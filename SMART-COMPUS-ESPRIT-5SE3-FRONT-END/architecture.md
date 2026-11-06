# SmartCampus — Architecture frontend et plan des 6 modules

## 1. Principes

1. **Monolithe modulaire par fonctionnalités** (_feature-based modulith_) : une seule application React, découpée en **6 modules métier** autonomes, un par micro-service du back-end.
2. **Dépendances à sens unique : `app → pages → features → shared`.** Une couche n'importe que celles qui sont à sa droite. **Une feature ne dépend jamais d'une autre feature** : le code commun descend dans `shared`.
3. **Séparation des responsabilités** : UI (`components/`, `pages/`), logique d'usage (`hooks/`), accès aux données (`api/` + `mocks/`), état global (session et registre des modules, exposés par `shared` et fournis par `app`).
4. **Inversion de dépendance pour le transverse** : `shared/auth/AuthContext` définit le contrat de session et `shared/modules/ModulesContext` celui du registre des modules ; le module Utilisateurs fournit la session, `app` fournit la liste des modules. Ainsi `shared` et les pages ne connaissent ni l'un ni l'autre.
5. **Tout appel réseau passe par `shared/api/client.ts`** (API Gateway + JWT). Chaque fonction d'API d'un module fournit son `mock`, donc l'app tourne sans backend (`VITE_USE_MOCKS=true`).
6. **Les textes** vivent dans `<module>/i18n` (`registerMessages`). Aucune chaîne en dur dans les composants.
7. **Rôles : 3 seulement** — `student`, `teacher`, `admin`. Les droits fins se règlent par permission, pas par de nouveaux rôles.
8. **Qualité automatisée** : TypeScript strict, ESLint (accessibilité, hooks, **frontières de couches**), Prettier, tests unitaires/composants (Vitest), test d'architecture, tests de bout en bout (Playwright). `npm run check` enchaîne le tout.

## 2. Structure globale

```
src/
├─ app/            Assemblage : seule couche qui connaît tous les modules
│  ├─ App.tsx · modules.ts (liste des 6 modules)
│  ├─ providers/   AppProviders (langue → session → registre → routeur → notifications)
│  ├─ router/      index.tsx (routes) · ProtectedRoute.tsx · routes.ts (chemins)
│  ├─ layout/      AppShell, Sidebar, TopBar, MobileNav, NavItems, DemoPanel
│  └─ styles/      globals.css · tokens.css (design tokens)
├─ pages/          Écrans qui composent plusieurs modules
│  └─ LandingPage · DashboardPage · ShowcasePage · ConflictDemoPage
├─ features/       Les 6 modules métier autonomes
│  └─ users | academic | resources | housing | student-life | library
├─ shared/         Transverse, sans logique métier, ne dépend de rien d'autre
│  ├─ api/         client.ts · errors.ts · useQuery.ts · useMutation.ts
│  ├─ auth/        roles.ts · jwt.ts · AuthContext.tsx (contrat de session)
│  ├─ modules/     ModulesContext.tsx (contrat du registre)
│  ├─ components/  ui/ (primitives shadcn) · common/ (StatCard, DataTable, EmptyState…) · Logo.tsx
│  ├─ config/ · events/ · services/ · types/ · i18n/ · lib/
├─ test/           setup.ts · test-utils.tsx · architecture.test.ts
└─ main.tsx        Point d'entrée
e2e/               Tests Playwright (desktop + téléphone)
```

Le détail fichier par fichier est dans `FICHIERS.md`.

## 3. Gabarit d'un module (identique pour les 6)

```
features/<module>/
├─ index.ts        API publique : ModuleDef (id, path, icône, rôles, Page lazy)
├─ README.md       fiche du module : rôles, pages, routes d'API, événements, règles
├─ api/            accès aux données : une fonction = une route du microservice (+ son mock)
├─ mocks/          données fictives typées + « base » en mémoire
├─ hooks/          useXxx() = useQuery/useMutation autour de api/
├─ types/ schemas/ utils/ i18n/
├─ components/     composants propres au module
└─ pages/          <Module>Module.tsx (sous-routes, onglets) + une page par écran
```

Règles : une page ne contient que de la composition (données via hooks, UI via composants) ; chaque page gère les états **chargement (skeleton) / vide (EmptyState) / erreur (503 → ServiceUnavailableView, 403, 409)** ; les événements de domaine s'affichent en toast. Un dossier vide ou inutile n'est pas créé.

**Frontières appliquées automatiquement** : `eslint.config.js` (règle `no-restricted-imports` par couche et par module) et `src/test/architecture.test.ts` (lit tous les imports, alias et relatifs). Une violation fait échouer `npm run check`.

## 4. Ordre de construction et contenu des modules

| #   | Module                                     | Rôles                      | Statut |
| --- | ------------------------------------------ | -------------------------- | ------ |
| 1   | **Utilisateurs** `/utilisateurs`           | admin (+ profil pour tous) | Fait   |
| 2   | **Académique** `/academique`               | student, teacher, admin    | Fait   |
| 3   | **Ressources** `/ressources`               | teacher, admin             | Fait   |
| 4   | **Résidences** `/residences`               | student, admin             | Fait   |
| 5   | **Vie étudiante & clubs** `/vie-etudiante` | student, teacher, admin    | Fait   |
| 6   | **Bibliothèque** `/bibliotheque`           | student, teacher, admin    | Fait   |

### Module 1 — Utilisateurs (user-service) — fait

```
users/
├─ index.ts · README.md · routes.ts · api/ · mocks/ · hooks/ · types/ · utils/ · i18n/
├─ auth/            (pages publiques)
│  ├─ AuthProvider.tsx · schemas.ts · api.mock.ts
│  ├─ components/   AuthShell, EmailField, PasswordInput, PasswordStrength, AttemptAlert,
│  │                CountdownButton, OtpInput, Field
│  └─ pages/        LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage
├─ components/      AccountForm, AccountStatusBadge, LoginHistoryTable, Fields
└─ pages/           UsersModule (onglets), UsersListPage, RolesMatrixPage, LoginHistoryPage, ProfilePage
```

Endpoints : `POST /auth/login`, `POST /users`, `GET /users/{id}`, `PUT /users/{id}/role`. Événements : `UtilisateurCréé`, `RôleModifié`.

### Module 2 — Académique (academic-service)

```
academic/
├─ index.ts · README.md · api/ · mocks/ · hooks/ · types/ · schemas/ · i18n/
├─ components/  CourseCard, TimetableGrid, GradeTable, EnrollmentStepper, ProgressRing
└─ pages/
   ├─ AcademicModule.tsx
   ├─ CoursesPage.tsx        catalogue + recherche (tous)
   ├─ CourseDetailPage.tsx   syllabus, enseignant, inscrits
   ├─ TimetablePage.tsx      emploi du temps (étudiant/enseignant)
   ├─ GradesPage.tsx         étudiant : mes notes · enseignant : saisie
   └─ EnrollmentsPage.tsx    inscriptions pédagogiques (admin valide : En attente → Validé/Refusé)
```

Types : `Course`, `Session`, `Enrollment`, `Grade`, `Semester`. Endpoints : `GET /courses`, `POST /enrollments`, `PUT /grades`. Événements : `InscriptionValidée`, `NotePubliée`. Règle : conflit d'horaire → 409 (`ConflictAlert`).

### Module 3 — Ressources (resource-service)

```
resources/
├─ index.ts · README.md · api/ · mocks/ · hooks/ · types/ · schemas/ · utils/ · i18n/
├─ components/  RoomCard, AvailabilityCalendar, ReservationForm, EquipmentList
└─ pages/
   ├─ ResourcesModule.tsx
   ├─ RoomsPage.tsx              salles et équipements, filtres capacité/bâtiment
   ├─ ReservationsPage.tsx       mes réservations (Timeline de statut)
   ├─ ReservationRequestPage.tsx formulaire + détection de conflit 409
   └─ ApprovalsPage.tsx          admin : valider / refuser
```

Types : `Room`, `Equipment`, `Reservation`. Endpoints : `GET /rooms`, `POST /reservations`, `PUT /reservations/{id}/status`. Événements : `RéservationCréée`, `RéservationConfirmée`. Composants partagés : `CapacityGauge`, `ConflictAlert`, `StatusPill`.

### Module 4 — Résidences (housing-service)

```
housing/
├─ index.ts · README.md · api/ · mocks/ · hooks/ · types/ · schemas/ · utils/ · i18n/
├─ components/  ResidenceCard, RoomPicker, HousingRequestStepper, OccupancyChart
└─ pages/
   ├─ HousingModule.tsx
   ├─ ResidencesPage.tsx   résidences + CapacityGauge
   ├─ MyRequestPage.tsx    étudiant : demande en 4 étapes (Stepper) + suivi (Timeline)
   ├─ RequestsPage.tsx     admin : file des demandes, affectation
   └─ MaintenancePage.tsx  signalement de pannes (remplace le rôle Technicien : l'admin les traite)
```

Types : `Residence`, `HousingRoom`, `HousingRequest`, `Ticket`. Endpoints : `GET /residences`, `POST /housing-requests`, `PUT /housing-requests/{id}/assign`. Événements : `DemandeDéposée`, `ChambreAffectée`. Règle : résidence pleine → 409.

### Module 5 — Vie étudiante & clubs (club-service)

```
student-life/
├─ index.ts · README.md · api/ · mocks/ · hooks/ · types/ · schemas/ · utils/ · i18n/
├─ components/  ClubCard, EventCard, MembershipButton, EventForm
└─ pages/
   ├─ StudentLifeModule.tsx
   ├─ ClubsPage.tsx          annuaire + adhésion
   ├─ ClubDetailPage.tsx     membres, événements
   ├─ EventsPage.tsx         agenda campus
   └─ ClubAdminPage.tsx      admin : créer/valider clubs, adhésions
```

Types : `Club`, `Membership`, `CampusEvent`. Endpoints : `GET /clubs`, `POST /clubs/{id}/members`, `POST /events`. Événements : `ClubCréé`, `AdhésionConfirmée`. (La gestion d'un club est faite par l'admin ; pas de rôle « responsable de club ».)

### Module 6 — Bibliothèque (library-service)

```
library/
├─ index.ts · README.md · api/ · mocks/ · hooks/ · types/ · schemas/ · utils/ · i18n/
├─ components/  BookCard, AvailabilityBadge, LoanRow, BookForm
└─ pages/
   ├─ LibraryModule.tsx
   ├─ CatalogPage.tsx      recherche, filtres, disponibilité
   ├─ BookDetailPage.tsx   emprunter / réserver
   ├─ MyLoansPage.tsx      prêts en cours, retards, prolongation
   └─ LoansAdminPage.tsx   admin : prêts, retours, ajout d'ouvrages
```

Types : `Book`, `Loan`, `Reservation`. Endpoints : `GET /books`, `POST /loans`, `PUT /loans/{id}/return`. Événements : `LivreEmprunté`, `LivreRetourné`.

## 5. Matrice des accès (3 rôles)

| Module        | Étudiant         | Enseignant        | Administrateur     |
| ------------- | ---------------- | ----------------- | ------------------ |
| Utilisateurs  | profil seul      | profil seul       | tout               |
| Académique    | ses cours, notes | ses cours, saisie | tout + validation  |
| Ressources    | —                | réserver          | tout + validation  |
| Résidences    | sa demande       | —                 | tout + affectation |
| Vie étudiante | adhérer          | adhérer           | tout               |
| Bibliothèque  | emprunter        | emprunter         | tout + gestion     |

## 6. Définition de « module terminé »

- Pages avec états chargement / vide / erreur (503, 403, 409).
- Mocks cohérents (base en mémoire) et endpoints typés dans `api.ts`.
- Textes dans `i18n.ts`, validation dans `schemas.ts`.
- Accessibilité : labels visibles, navigation clavier, contraste AA, focus visible.
- `npm run check` (types, lint, format, tests) et `npm run build` sans erreur ; aucune modification des autres modules, aucun import vers une autre feature.
