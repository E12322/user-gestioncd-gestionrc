# Passation : SmartCampus, projet d'intégration complet

Dernière mise à jour : 10 novembre 2026. Ce fichier dit **où l'on en est, comment lancer, ce qui est sûr, ce qui ne l'est pas et quoi faire ensuite**. Les détails sont dans `docs/` ; le code reste la source de vérité.

> Il remplace, pour le projet complet, l'ancien `handoff.md` du seul user-service (dépôt `SMART-COMPUS-ESPRIT-5SE3-USER-SERVICE`, branche `FarahBack`), qui reste valable pour le module Utilisateurs.

---

## 1. Où se trouve quoi

| Quoi | Où |
|---|---|
| Dossier du projet | `C:\dev\SMART-CAMPUS-FULL\app` |
| Raccourci et lanceurs | Bureau → dossier `SmartCampus` (`Lancer SmartCampus.bat`, `Arreter SmartCampus.bat`, `LISEZ-MOI.txt`) |
| Dépôt GitHub (fork) | <https://github.com/Farah893/user-gestioncd-gestionrc>, branche **`integration-final`** (remote git `farah`) |
| Dépôt GitHub (équipe) | <https://github.com/E12322/user-gestioncd-gestionrc>, branche **`integration-final`** (remote git `origin`) |
| Application en ligne | <https://user-gestioncd-gestionrc-eight.vercel.app> |
| Services en ligne | `smartcampus-user` et `smartcampus-agent` sur Render ; base MongoDB Atlas |

La branche `main` du dépôt de l'équipe **n'a pas ce travail** : tout est sur `integration-final`. Une pull request `integration-final` → `main` reste à faire.

### Contenu du dossier

`SMART-COMPUS-BACK-END-ESPRIT-5SE3` (utilisateurs, Node, 4001) · `gestionetudiant` (académique, Spring, 8081) · `SMART-COMPUS-BACKEND` (ressources, Spring, 8080) · `backend-residences` (NestJS : passerelle 3001 + microservices 3011-3013) · `gestion-bibliotheque` (FastAPI, 8082) · `vie-etudiante` (Spring, 4005) · `agent-service` (assistant IA, FastAPI, 4010) · `SMART-COMPUS-ESPRIT-5SE3-FRONT-END` (React/Vite, 5173) · `docs/` · `scripts/` (lancement, arrêt, remise à zéro de la vie étudiante) · `render.yaml`.

---

## 2. Lancer et tester

- **Lancer tout** : double-clic sur `Lancer SmartCampus.bat` (Bureau), ou `.\scripts\lancer-tout.ps1`. Il ignore les services déjà actifs. Prérequis : Docker Desktop démarré, MongoDB en service (`net start MongoDB` dans un PowerShell **administrateur**).
- **Arrêter** : `Arreter SmartCampus.bat` ou `.\scripts\arreter-tout.ps1` (`-Docker` pour arrêter aussi PostgreSQL et RabbitMQ ; MongoDB n'est jamais arrêté).
- **Lancer à la main, comptes, parcours de recette, tests automatiques, dépannage** : `docs/GUIDE-LANCEMENT-ET-TESTS.md`.
- **Compte administrateur local** : `admin@gmail.com` (mot de passe dans le guide). Comptes **en ligne** : séparés (base Atlas).

---

## 3. État du projet

| Module | En local | En ligne | Sécurité vérifiée | Tests |
|---|---|---|---|---|
| Utilisateurs | oui | **oui** | oui (audit du 4 novembre + vérifié) | 85 |
| Académique | oui | non | rôles par URL et par propriétaire (9 nov.) | 34 |
| Ressources | oui | non | JWT, rôles, identité du jeton (9 nov.) | 21 |
| Résidences | oui | non | passerelle + clé interne des microservices (9 nov.) | 75 |
| Bibliothèque | oui | non | cookie, fin de l'identité par défaut (9 nov.) | 16 |
| Vie étudiante | oui | non (Dockerfile et service Render prêts) | catalogue public voulu ; reste protégé | n/a |
| Assistant IA | oui | **oui** (profil, règlement) | oui | 95 |
| Front | oui | **oui** | n/a | 58 |

**Vérifié dans un navigateur automatisé (Edge sans interface), en admin** : connexion, les six modules, ajout d'un livre, validation d'une réservation, pages de la vie étudiante, assistant. **Non vérifié** : aucune vue enseignant ou étudiant à l'écran (mots de passe inconnus ; les rôles ont été testés par API avec des jetons de test), mobile, clavier, lecteur d'écran, voix dans le navigateur.

### Ce qui a été fait le 9 et 10 novembre (dans l'ordre)

1. Intégration de l'agent IA et du widget dans le front du dépôt d'intégration ; correction du `pyproject.toml` ; `agent-service/` ajouté (`1c16b89`).
2. Outils de l'agent sur les cours, salles, chambres, livres, emprunts, clubs, événements (lecture seule) ; voix Piper dans le widget (`8cccc1e`, `e016fe2`).
3. Module Vie étudiante ajouté depuis `feature/vie-etudiante` (`8c83ba9`) puis ses pages front (adhésions, événements, rapport) (`185ef6c`).
4. Suppression du « Mode démo » (barre du haut et page de connexion).
5. Mise en ligne gratuite : `render.yaml`, `vercel.json`, Dockerfiles, `docs/DEPLOIEMENT.md` (`34c6235`).
6. Correctifs de routage du front : clubs vers la vie étudiante, `/rooms` et `/reservations` vers les ressources (`6144ab4`, `3f2d45d`).
7. **Audit de sécurité des modules** et corrections : résidences (cookie, `855aa44` ; clé interne, jeton de démonstration, CORS, `129bacc`), bibliothèque (`a59449d`), ressources (`353faed`), académique (`129bacc`).
8. Documents : `docs/DOCUMENT-TECHNIQUE-JURY.md`, `docs/DOCUMENT-AGENT-IA.md`, `docs/GUIDE-LANCEMENT-ET-TESTS.md`, ce fichier ; scripts de lancement.

---

## 4. À faire, par priorité

1. **Étape 2 de la mise en ligne** (académique, ressources, résidences, bibliothèque, vie étudiante). **Préalable bloquant** : ces services vérifient les jetons avec un **secret partagé (HS256)** alors que le user-service de production signe en **RS256**. Il faut leur faire lire la clé publique (`/.well-known/jwks.json`), comme le fait déjà l'agent. Voir aussi les Dockerfiles et les variables (`JWT_SECRET`, `CORS_ORIGINS`, `INTERNAL_API_KEY` pour les résidences).
2. **Pull request** `integration-final` → `main` (dépôt de l'équipe).
3. **Intégration continue** : les `ci.yml` sont dans des sous-dossiers, donc **jamais exécutés** (0 exécution sur les deux dépôts). Créer un workflow à la racine qui lance les tests de chaque module.
4. **Vérifier l'e-mail en ligne** : s'inscrire avec une adresse Gmail et regarder si le code arrive. Render gratuit bloque peut-être le SMTP ; sinon passer à l'API Gmail ou à Resend/Brevo.
5. **Voir l'interface avec de vrais comptes enseignant et étudiant** (réservation de salle, résidences en étudiant, notes en enseignant).
6. **Double authentification** (non faite).
7. **Identifiants de l'académique** : l'identifiant numérique est dérivé des chiffres du jeton (`ETU-2026-0002` et `ADM-2026-0002` donnent le même nombre). À remplacer par l'identifiant texte.
8. Agent IA : rejouer les évaluations adverses (`python -m evals.run_evals`) après l'ajout des outils ; écriture sur les autres modules avec confirmation ; recherche sémantique ; faire valider le contenu du règlement par l'administration.
9. Six fichiers du module Résidences (`RoomPicker`, `MyRequestPage`…) existent sur d'autres branches mais pas sur la base d'intégration : confirmer avec leur auteur s'ils doivent revenir.

---

## 5. Pièges connus

- **Java 23 ou plus** : ajouter `-Dmaven.compiler.proc=full` (Lombok) ; `vie-etudiante` demande aussi `-Dlombok.version=1.18.42`. Le script de lancement le fait tout seul selon la version de Java détectée.
- **MongoDB est un service Windows** : le démarrer demande les droits administrateur. Sans lui, la connexion répond 500.
- **Disque plein** : il est tombé à 0 octet libre pendant le travail (MongoDB s'est arrêté). Surveiller l'espace.
- **Un secret JWT différent entre services** : tous les jetons sont refusés. En développement, tous utilisent la même valeur (voir le guide).
- **Limites de connexion** : 10 tentatives par 15 minutes ; 5 mots de passe faux suspendent le compte 15 minutes.
- **Ressources** : base H2 en mémoire, remise à zéro à chaque redémarrage (réservations de départ : 2).
- **Vie étudiante** : le service ne recrée ses données de démonstration (7 clubs, 7 événements) que si la table des clubs est **vide**. Si des clubs ont été supprimés depuis la page Gestion, `node scripts/reinitialiser-vie-etudiante.js` (puis `--oui`) vide les trois collections, et le redémarrage du service les recrée. **L'état local actuel n'a que 2 clubs sur 7** et n'a pas encore été remis à zéro.
- **Le Bureau est dans OneDrive** : n'y mettre aucun fichier avec des secrets.
- **Terminaux lancés depuis un outil** : si le script est lancé depuis un terminal qui se ferme, les fenêtres filles se ferment avec lui. Le lancer depuis un PowerShell ou le `.bat` du Bureau.
- **Le front n'accepte que les adresses `@gmail.com`** (réglage `VITE_EMAIL_DOMAIN`).

---

## 6. Décisions et raisons

| Décision | Raison |
|---|---|
| Jeton en cookie `httpOnly`, protection CSRF par en-tête + origine | une faille XSS ne peut pas voler le jeton ; un site tiers ne peut pas écrire |
| Chaque service vérifie lui-même le jeton et applique les rôles | l'interface ne protège rien ; la garantie de l'agent (« les services restent l'autorité ») n'est vraie que si c'est le cas |
| Vercel relaie `/svc/*` vers Render | une seule origine pour le navigateur : cookies valides sans domaine propre, gratuit |
| Agent sans droit propre, écriture après clic | limiter ce qu'un modèle manipulé peut faire |
| Résidences : clé interne entre passerelle et microservices | les microservices répondaient à tout le monde |
| Jeton de démonstration refusé par défaut (résidences), identité par en-têtes désactivée (bibliothèque) | ils permettaient de se déclarer administrateur |
| Pas de copie du projet au Bureau | OneDrive enverrait les secrets dans le cloud |

---

## 7. Fichiers locaux sensibles ou temporaires (à nettoyer)

| Élément | Remarque |
|---|---|
| `C:\dev\SMART-CAMPUS-FULL\VALEURS-RENDER.txt` | **contient des secrets** (clé Gemini, mot de passe Gmail, clé RSA, accès Atlas). À supprimer après usage |
| `C:\dev\SMART-CAMPUS-FULL\mongo-data` | base MongoDB temporaire de test, plus utilisée |
| Base locale `smartcampus_users_integ` | base de test, plus utilisée |
| Base Atlas `smartcampus_users_localtest` | créée par un essai ; le droit de la supprimer manquait, à supprimer dans l'interface Atlas |
| `C:\dev\SMART-COMPUS-ESPRIT-5SE3-USER-SERVICE`, `C:\dev\SMART-COMPUS-ESPRIT-5SE3-FRONT-END` | dépôts d'origine (backend et front de Farah) ; le travail courant est dans `SMART-CAMPUS-FULL\app` |
| `.env`, `keys/`, `voices/`, `venv/`, `node_modules/` | jamais dans git (vérifié) |

**Secrets exposés dans des conversations** : une clé Gemini (conservée par décision), le mot de passe de la base Atlas, et le mot de passe de départ de l'admin en ligne. À renouveler avant tout usage réel.

---

## 8. Documents

| Besoin | Fichier |
|---|---|
| Lancer, tester, dépanner | `docs/GUIDE-LANCEMENT-ET-TESTS.md` |
| Architecture, sécurité, questions du jury | `docs/DOCUMENT-TECHNIQUE-JURY.md` |
| L'assistant IA (construction, sécurité, questions) | `docs/DOCUMENT-AGENT-IA.md` |
| Mise en ligne (Vercel, Render, Atlas) | `docs/DEPLOIEMENT.md` |
| Module Utilisateurs en détail | `SMART-COMPUS-BACK-END-ESPRIT-5SE3/docs/` |
| Module Résidences | `docs/SmartCampus-Residences-AI-Context.md` (décrit la v1 ; voir l'encadré en tête pour la v2) |
