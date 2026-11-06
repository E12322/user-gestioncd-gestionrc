# SmartCampus — Front-end

Plateforme numérique de campus : cours, notes, salles, résidences, clubs et bibliothèque pour les **étudiants**, **enseignants** et **administrateurs**.

Ce dépôt contient **uniquement le front-end** (une seule application React). Le back-end est en microservices et vit dans un autre dépôt. En attendant, le front tourne seul avec des **données fictives** (mode démo).

**Technologies** : React 19 · TypeScript · Vite · Tailwind CSS 3 · shadcn/ui (Radix) · lucide-react · zod · React Router. Interface en français.

## Démarrer

Prérequis : **Node.js 20.19+ ou 22.12+** (testé avec Node 24) et npm.

```bash
npm install
cp .env.example .env     # configuration locale (facultatif : les valeurs par défaut suffisent)
npm run dev              # http://localhost:5173
```

| Commande            | Rôle                                                   |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Serveur de développement                               |
| `npm run typecheck` | Vérifie les types TypeScript (doit passer sans erreur) |
| `npm run build`     | Vérification + build de production dans `dist/`        |
| `npm run preview`   | Sert le build de production                            |

> Un seul `npm run dev` à la fois. Si la page reste blanche après avoir déplacé des fichiers, arrêtez le serveur (Ctrl+C) et relancez-le.

## Tester l'application

Au départ, personne n'est connecté : la page publique d'accueil s'affiche sur `/`. Cliquez sur **Se connecter**.

La page de connexion propose un encadré orange **« Mode démo »** avec trois boutons (Étudiant, Enseignant, Administrateur) qui ouvrent directement une session, sans mot de passe. On peut aussi saisir un compte fictif :

| Rôle           | E-mail (domaine par défaut `smartcampus.tn`) | Mot de passe  |
| -------------- | -------------------------------------------- | ------------- |
| Étudiant       | `yasmine.bensalah@smartcampus.tn`            | `Campus2026!` |
| Enseignant     | `karim.trabelsi@smartcampus.tn`              | `Campus2026!` |
| Administrateur | `sonia.gharbi@smartcampus.tn`                | `Campus2026!` |

Le code de vérification d'e-mail (inscription) est `123456`.

**Parcours utiles**

- **Créer un enseignant** : se connecter en administrateur → _Utilisateurs_ → _Créer un compte_. Un mot de passe temporaire est généré (en démo, il s'affiche dans la fenêtre de confirmation). À sa première connexion, l'enseignant doit choisir un nouveau mot de passe, différent du temporaire.
- **Inscription publique** : `/inscription` crée toujours un compte **étudiant**.
- **Profil** : _Mon profil_ (menu en haut à droite) → modifier ses informations, ajouter une photo, changer son mot de passe.
- **Conflits (409)** : réserver l'Amphi A demain entre 14h et 16h (enseignant) ; adhérer au Club Théâtre (complet) ; emprunter _Clean Architecture_ (étudiant).
- **Panne simulée** : le bouton ambre « Mode démo » de la barre du haut permet de mettre un module en panne (503) sans affecter les autres.

> Les données fictives sont **en mémoire** : elles reviennent à zéro quand on recharge la page. Seules les photos de profil et la session restent dans le navigateur.

## Configuration (`.env`)

| Variable            | Défaut                      | Rôle                                                          |
| ------------------- | --------------------------- | ------------------------------------------------------------- |
| `VITE_USE_MOCKS`    | `true`                      | `true` : données fictives. `false` : appelle le vrai back-end |
| `VITE_API_BASE_URL` | `http://localhost:8080/api` | Adresse de l'API Gateway (utilisée si `VITE_USE_MOCKS=false`) |
| `VITE_EMAIL_DOMAIN` | `smartcampus.tn`            | Domaine d'e-mail accepté (ex. `gmail.com` pour des tests)     |

Le fichier `.env` est propre à chaque poste et n'est **pas** versionné ; le modèle est `.env.example`. Après modification, relancer `npm run dev`.

## Organisation du code

```
src/
├─ api/          client unique vers l'API Gateway (JWT, erreurs normalisées), useQuery, useMutation
├─ auth/         rôles (student, teacher, admin), session, garde de routes
├─ components/   ui/ (primitives shadcn) et shared/ (composants communs)
├─ i18n/         textes français de base
├─ layout/       coque de l'application (barre, menu)
├─ lib/          utilitaires
└─ features/
   ├─ registry.ts   liste des 6 modules (navigation, routes, droits)
   ├─ home/         page d'accueil publique
   ├─ dashboard/    tableau de bord après connexion
   └─ users | academic | resources | housing | student-life | library
```

Chaque module (`src/features/<module>/`) a ses dossiers dédiés et un `README.md` :

```
<module>/
├─ README.md   rôles, pages, routes d'API, événements, règles métier
├─ index.ts    définition du module (route, icône, rôles)
├─ api/        fonctions d'API (une fonction = une route du microservice) + mock
├─ mocks/      données fictives
├─ hooks/      useXxx() autour de api/
├─ types/      entités et filtres
├─ schemas/    validation des formulaires (zod)
├─ utils/      fonctions pures
├─ i18n/       textes français du module
├─ components/ composants propres au module
└─ pages/      un écran = une page
```

Règles d'équipe :

- **Un module n'importe jamais un autre module** : il ne dépend que de `src/api`, `src/auth`, `src/components`, `src/i18n`, `src/lib`.
- Aucun texte en dur dans les composants : tout passe par `i18n/`.
- Chaque page gère les états chargement, vide et erreur (503, 403, 409).
- Rôles : `student`, `teacher`, `admin` seulement ; les droits fins se règlent par permission.
- Avant de proposer une modification : `npm run typecheck` et `npm run build` doivent passer.

Plan détaillé des modules : [`architecture.md`](./architecture.md).

## Git : branche `main` protégée (Rulesets)

**Personne ne pousse directement sur `main`**, pas même un membre du groupe. Tout passe par une branche et une Pull Request (PR).

**Workflow**

```bash
git switch main && git pull                 # partir d'un main à jour
git switch -c feature/<module>-<sujet>      # ex. feature/library-emprunts
# ... modifier, puis vérifier :
npm run typecheck && npm run build
git add . && git commit -m "library: ajoute la page des emprunts"
git push -u origin feature/<module>-<sujet>
```

Ensuite, ouvrir une **Pull Request** vers `main` sur GitHub ; un autre membre la relit et l'approuve avant la fusion (_Merge_).

**Mettre en place la protection (une seule fois, par le propriétaire du dépôt)**

GitHub → _Settings_ → _Rules_ → _Rulesets_ → _New ruleset_ → _New branch ruleset_ :

1. **Ruleset name** : `protect-main` · **Enforcement status** : `Active`.
2. **Target branches** → _Add target_ → _Include default branch_ (`main`).
3. Cocher :
   - **Restrict deletions** : `main` ne peut pas être supprimée ;
   - **Block force pushes** : pas de `git push --force` ;
   - **Require a pull request before merging** : 1 approbation minimum, et _Dismiss stale approvals_ ;
   - **Require status checks to pass** (si une CI `typecheck` / `build` existe).
4. **Bypass list** : laisser vide pour que la règle s'applique à tous.
5. _Create_.

Résultat : un `git push origin main` direct est refusé ; seule la fusion d'une PR approuvée modifie `main`.

## Brancher le vrai back-end (plus tard)

Chaque fonction d'`api/` appelle l'API Gateway et fournit son `mock`. Quand un microservice est prêt : mettre `VITE_USE_MOCKS=false` et l'adresse de la Gateway dans `VITE_API_BASE_URL`. Les routes, formats, erreurs et événements attendus de chaque service sont décrits dans le `README.md` du module concerné.
