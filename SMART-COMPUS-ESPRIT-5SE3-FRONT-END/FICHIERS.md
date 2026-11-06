# SmartCampus front-end : à quoi sert chaque fichier

Ce document explique **chaque fichier de configuration** et **chaque dossier du code**. Il complète `architecture.md` (principes) et `README.md` (démarrage).

## 1. Le principe en une phrase

Le projet est un **monolithe modulaire par fonctionnalités** (_feature-based modulith_) : **une seule application React**, découpée en **6 modules métier** autonomes. Les dépendances ne vont que dans un sens :

```
app  →  pages  →  features (les 6 modules)  →  shared
```

- Une couche ne peut importer que celles qui sont à sa droite.
- **Une feature n'importe jamais une autre feature.** Si deux modules ont besoin du même code, ce code descend dans `shared`.
- Cette règle est vérifiée automatiquement (ESLint + `src/test/architecture.test.ts`) : une violation fait échouer `npm run check`.

---

## 2. Les fichiers à la racine du projet

### Code et dépendances

| Fichier             | À quoi il sert                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`      | Carte d'identité du projet : liste des dépendances et **scripts** (voir section 5). `typescript` est fixé en 6.0.x car `typescript-eslint` ne supporte pas encore TypeScript 7. |
| `package-lock.json` | Versions exactes installées. Ne s'édite pas à la main ; il garantit que toute l'équipe a les mêmes versions.                                                                    |
| `index.html`        | Page HTML unique. Elle contient `<div id="root">` et charge `src/main.tsx`.                                                                                                     |

### Build et TypeScript

| Fichier                | À quoi il sert                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`       | Configuration de Vite (serveur de développement et build). Déclare l'alias `@` = `src`, ce qui permet d'écrire `@/shared/...` au lieu de `../../..`. |
| `tsconfig.json`        | Configuration TypeScript en mode strict : le compilateur refuse les types douteux. Il couvre `src`, `e2e` et les fichiers de config.                 |
| `tsconfig.tsbuildinfo` | Cache du compilateur (`tsc -b`). Généré automatiquement, ignoré par git.                                                                             |

### Style (Tailwind)

| Fichier              | À quoi il sert                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tailwind.config.ts` | Configuration de Tailwind : polices (Source Serif 4 pour les titres, Public Sans pour le texte), couleurs de la marque (`navy`, etc.), rayons, ombres. Les couleurs de base viennent de `tokens.css`. |
| `postcss.config.js`  | Branche Tailwind et Autoprefixer dans la chaîne CSS. Ne se modifie presque jamais.                                                                                                                    |

### Qualité automatique (lint, format, tests)

| Fichier                | À quoi il sert                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.js`     | **Le lint** : détecte les bugs probables, les problèmes d'accessibilité (`jsx-a11y`), les erreurs de hooks React, et **interdit les imports qui violent les couches** (ex. une feature qui importe `@/app/...` ou une autre feature).     |
| `.prettierrc`          | **Le format** : largeur 140, guillemets doubles, points-virgules, virgules finales. Tout le code est formaté pareil, quel que soit l'auteur.                                                                                              |
| `.prettierignore`      | Liste ce que Prettier **ne doit pas** reformater : `node_modules`, `dist`, `package-lock.json`, les sorties de test, les dossiers d'outils (`.claude`, `.impeccable`, `.playwright-cli`). Même rôle que `.gitignore`, mais pour Prettier. |
| `vitest.config.ts`     | **Tests unitaires et de composants** : environnement `jsdom` (un faux navigateur), fichier de préparation `src/test/setup.ts`, et `VITE_USE_MOCKS=true` pour toujours tester sur les données fictives.                                    |
| `playwright.config.ts` | **Tests de bout en bout** : lance l'application sur le port 5174 avec les données fictives, puis la teste dans Chrome en format **desktop** et **téléphone** (Pixel 7).                                                                   |

### Configuration d'environnement et git

| Fichier        | À quoi il sert                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`         | **Vos réglages locaux** (adresse de l'API, mode mock ou vrai back-end). Jamais commité : il peut contenir des valeurs propres à votre machine.                                           |
| `.env.example` | **Le modèle** commité de `.env`. Quand un nouveau développeur arrive, il le copie en `.env`. Il documente chaque variable (`VITE_API_BASE_URL`, `VITE_USE_MOCKS`, `VITE_EMAIL_DOMAIN`…). |
| `.gitignore`   | Fichiers que git ignore : `node_modules`, `dist`, `.env`, journaux, fichiers d'éditeur et de système.                                                                                    |

### Documentation

| Fichier           | À quoi il sert                                  |
| ----------------- | ----------------------------------------------- |
| `README.md`       | Démarrage rapide du projet.                     |
| `architecture.md` | Principes d'architecture et plan des 6 modules. |
| `FICHIERS.md`     | Ce document.                                    |

### Dossiers générés (pas du code de l'application)

| Dossier         | À quoi il sert                                                               |
| --------------- | ---------------------------------------------------------------------------- |
| `node_modules/` | Les dépendances téléchargées par `npm install`. Se régénère, jamais commité. |
| `dist/`         | Le site compilé par `npm run build`. Se régénère, jamais commité.            |
| `e2e/`          | Les tests de bout en bout (voir section 4).                                  |

---

## 3. Le code : `src/`

### `src/main.tsx`

Point d'entrée : monte `<App />` dans `#root` et charge les styles globaux. Rien d'autre.

### `src/app/` : assemble l'application

Seule couche qui **connaît tous les modules**. Elle ne contient aucune logique métier.

| Fichier                                                             | À quoi il sert                                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `App.tsx`                                                           | Compose `AppProviders` puis `AppRouter`.                                                                                                                     |
| `providers/AppProviders.tsx`                                        | Empile les fournisseurs globaux : langue → session → registre des modules → routeur → notifications.                                                         |
| `router/index.tsx`                                                  | **La table des routes** : pages publiques, puis tout ce qui exige une session (la coque + les 6 modules). Gère aussi le 403 par rôle.                        |
| `router/ProtectedRoute.tsx`                                         | Garde de session : sans session, `/` montre la page d'accueil et le reste redirige vers `/connexion` ; avec un mot de passe temporaire, force le changement. |
| `router/routes.ts`                                                  | Constantes des chemins (`/connexion`, `/profil`…) : une seule source pour les liens et les tests.                                                            |
| `modules.ts`                                                        | **La liste des 6 modules**, dans l'ordre d'affichage du menu.                                                                                                |
| `layout/AppShell.tsx`                                               | La « coque » de l'application connectée : barre du haut, menu latéral, zone de contenu.                                                                      |
| `layout/Sidebar.tsx`, `NavItems.tsx`, `MobileNav.tsx`, `TopBar.tsx` | Menu latéral, entrées de navigation, menu mobile, barre du haut (recherche, notifications, profil).                                                          |
| `layout/DemoPanel.tsx`                                              | Panneau de démonstration : changer de rôle, simuler la panne d'un module, voir les pages d'erreur.                                                           |
| `styles/globals.css`                                                | Styles globaux : directives Tailwind, base typographique (titres en serif), focus, sélection, animations d'entrée.                                           |
| `styles/tokens.css`                                                 | **Design tokens** : les variables de couleur (`--primary`, `--background`…) et le rayon. Une seule source de vérité pour la palette.                         |

### `src/pages/` : écrans qui composent plusieurs modules

| Dossier             | À quoi il sert                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LandingPage/`      | Page d'accueil publique (`/` sans session). `i18n.ts` contient ses textes français.                                                                                                   |
| `DashboardPage/`    | Tableau de bord après connexion. `components/` = bannière, cartes principales et latérales ; `hooks.ts` = chargement des données ; `mock.ts` = données fictives ; `types.ts` = types. |
| `ShowcasePage/`     | Catalogue de composants (`/demo/composants`).                                                                                                                                         |
| `ConflictDemoPage/` | Démonstration d'une erreur 409 (`/demo/409`).                                                                                                                                         |

### `src/features/` : les 6 modules métier

Chaque module est **autonome** et suit le même gabarit :

| Sous-dossier         | Contenu                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`           | **API publique** du module : sa définition (identifiant, chemin, icône, rôles autorisés) et la page principale chargée à la demande. |
| `api/`               | **Accès aux données** : une fonction par route du micro-service, avec sa version fictive (`mock`).                                   |
| `hooks/`             | **Logique d'usage** : hooks (`useCourses`…) qui appellent `api/` et gèrent chargement et erreurs.                                    |
| `components/`        | **UI propre au module** (cartes, grilles, formulaires).                                                                              |
| `pages/`             | **Écrans du module** : `XxxModule.tsx` (sous-routes et onglets) et une page par écran.                                               |
| `types/`, `schemas/` | Types métier et validation des formulaires (zod).                                                                                    |
| `mocks/`             | Données fictives typées et « base » en mémoire.                                                                                      |
| `i18n/`              | Textes français du module.                                                                                                           |
| `README.md`          | Fiche du module : rôles, routes d'API, événements, règles métier.                                                                    |

Les 6 modules : `users` (comptes, rôles, **authentification**), `academic` (cours, notes, emploi du temps), `resources` (salles, réservations), `housing` (résidences), `student-life` (clubs, événements), `library` (livres, emprunts).

**Le module `users` a en plus** :

| Fichier                               | À quoi il sert                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `auth/AuthProvider.tsx`               | **Implémente la session** : connexion, déconnexion, persistance dans `localStorage`, jeton JWT.    |
| `auth/pages/`                         | Pages de connexion, inscription, vérification e-mail, mot de passe oublié / réinitialisé / changé. |
| `auth/components/`                    | Champs de formulaire d'authentification, jauge de mot de passe, saisie du code OTP.                |
| `auth/schemas.ts`, `auth/api.mock.ts` | Validation des formulaires et faux back-end d'authentification.                                    |
| `routes.ts`                           | Expose les pages d'authentification à la couche `app`.                                             |

### `src/shared/` : code transverse, sans logique métier

Ne dépend d'**aucune** autre couche.

| Dossier / fichier                   | À quoi il sert                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/client.ts`                     | **Client HTTP unique** : ajoute le jeton, renouvelle la session, bascule entre vrai back-end et données fictives.                                                                                                                                                                                                                                                                     |
| `api/errors.ts`                     | Erreur API normalisée (`ApiError` avec son code HTTP).                                                                                                                                                                                                                                                                                                                                |
| `api/useQuery.ts`, `useMutation.ts` | Hooks de lecture et d'écriture des données (chargement, erreur, réessai).                                                                                                                                                                                                                                                                                                             |
| `auth/roles.ts`                     | Les 3 rôles (étudiant, enseignant, administrateur), leurs libellés et les utilisateurs de démo.                                                                                                                                                                                                                                                                                       |
| `auth/jwt.ts`                       | Fabrique un faux jeton JWT pour le mode démo.                                                                                                                                                                                                                                                                                                                                         |
| `auth/AuthContext.tsx`              | **Contrat de session** (la forme des données et le hook `useAuth`). Le module `users` le fournit ; tous les modules le lisent sans dépendre de `users`.                                                                                                                                                                                                                               |
| `modules/ModulesContext.tsx`        | **Contrat du registre des modules** : `app` le remplit, les pages le lisent (`useModules`) sans importer `app`.                                                                                                                                                                                                                                                                       |
| `types/module.ts`                   | Le type `ModuleDef` : ce que chaque module doit déclarer.                                                                                                                                                                                                                                                                                                                             |
| `components/ui/`                    | Briques de base de l'interface (bouton, champ, carte, boîte de dialogue, menu déroulant, squelette…).                                                                                                                                                                                                                                                                                 |
| `components/common/`                | Composants réutilisables composés : `CatalogRow` (ligne de catalogue : titre, infos, jauge, actions — remplace les grilles de cartes), `StatCard`, `DataTable`, `EmptyState`, `StatusPill`, `Stepper`, `Timeline`, `ConfirmDialog`, `ErrorViews` (403/404/503), `QueryBoundary` (chargement/erreur/données), `ModuleBoundary` (une panne de rendu n'emporte pas toute l'application)… |
| `components/Logo.tsx`               | Logo SmartCampus.                                                                                                                                                                                                                                                                                                                                                                     |
| `config/env.ts`                     | Lit les variables d'environnement (mode mock, domaine d'e-mail accepté).                                                                                                                                                                                                                                                                                                              |
| `events/domainEvents.ts`            | Événements de domaine publiés par les modules (affichés en notification en démo).                                                                                                                                                                                                                                                                                                     |
| `services/serviceHealth.ts`         | Simule la panne d'un micro-service pour montrer qu'un module peut tomber seul.                                                                                                                                                                                                                                                                                                        |
| `i18n/`                             | Traduction : `fr.ts` (textes communs) et le fournisseur de langue.                                                                                                                                                                                                                                                                                                                    |
| `lib/`                              | Fonctions pures : `utils.ts` (`cn`, initiales), `format.ts` (dates), `image.ts` (recadrage des avatars), `tones.ts` (couleurs de statut).                                                                                                                                                                                                                                             |

### `src/test/` : outillage de test

| Fichier                | À quoi il sert                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `setup.ts`             | Préparation commune : matchers `jest-dom`, nettoyage entre chaque test, vidage de `localStorage`.                                    |
| `test-utils.tsx`       | `renderWithProviders` : rend un composant avec les vrais fournisseurs (langue, session, routeur).                                    |
| `architecture.test.ts` | **Test d'architecture** : lit tous les imports et échoue si la règle des couches est violée, ou s'il n'y a pas exactement 6 modules. |

Les fichiers `*.test.ts(x)` sont placés **à côté du code qu'ils testent** (`utils.test.ts`, `AuthProvider.test.tsx`, `ModulesContext.test.tsx`, `PasswordStrength.test.tsx`).

---

## 4. Les tests de bout en bout : `e2e/`

| Fichier           | À quoi il sert                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `landing.spec.ts` | La page d'accueil s'affiche, mène à la connexion, **ne déborde pas** sur téléphone, et une page protégée redirige vers `/connexion`. |
| `session.spec.ts` | Connexion de démonstration (étudiant) puis arrivée sur le tableau de bord.                                                           |

## 5. Les commandes (`package.json`)

| Commande                          | Ce qu'elle fait                                                                |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                     | Lance l'application en développement.                                          |
| `npm run build`                   | Vérifie les types puis compile le site dans `dist/`.                           |
| `npm run typecheck`               | Vérifie uniquement les types TypeScript.                                       |
| `npm run lint` / `lint:fix`       | Lance ESLint / corrige ce qui peut l'être.                                     |
| `npm run format` / `format:check` | Reformate avec Prettier / vérifie sans modifier.                               |
| `npm test` / `test:watch`         | Tests unitaires et de composants / en continu.                                 |
| `npm run test:e2e`                | Tests de bout en bout (desktop + téléphone).                                   |
| `npm run check`                   | **Tout enchaîner** : types, lint, format, tests. À lancer avant chaque commit. |

## 6. Où mettre un nouveau fichier ?

1. Utile à **un seul module** → dans `features/<module>/`.
2. Utile à **plusieurs modules** et sans logique métier → dans `shared/`.
3. Un écran qui **réunit plusieurs modules** → dans `pages/`.
4. Du **câblage global** (routes, fournisseurs, menu) → dans `app/`.
5. Un module a besoin du code d'un autre module → **ne pas l'importer** ; descendre le code commun dans `shared/`.
