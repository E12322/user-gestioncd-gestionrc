# SmartCampus : document technique et questions pour le jury

Projet académique d'architecture microservices, ESPRIT 5SE3 (2026). Dernière mise à jour : 10 novembre 2026.

Ce document dit **ce qui existe, comment c'est construit, ce qui a été vérifié et ce qui ne l'est pas**. Chaque chiffre vient d'une exécution réelle ; les limites sont écrites sans détour, parce qu'un jury les trouve de toute façon. Compléments : `DOCUMENT-AGENT-IA.md` (l'assistant), `GUIDE-LANCEMENT-ET-TESTS.md` (lancer et tester), `DEPLOIEMENT.md` (mise en ligne).

---

## 1. Le projet en bref

SmartCampus réunit sur une seule plateforme web les activités du campus : comptes et droits, cours et notes, salles, résidences, bibliothèque, clubs, et un **assistant IA**. Trois rôles : **étudiant**, **enseignant**, **administrateur**.

| Module | Techno | Port | Données |
|---|---|---|---|
| Utilisateurs et authentification | Node.js, Express, TypeScript | 4001 | MongoDB |
| Académique (cours, notes, absences, groupes, planning) | Spring Boot | 8081 | H2 |
| Ressources (salles, réservations) | Spring Boot | 8080 | H2 (mémoire) |
| Résidences (passerelle + 3 microservices) | NestJS | 3001, 3011-3013 | PostgreSQL, RabbitMQ |
| Bibliothèque | Python, FastAPI | 8082 | SQLite |
| Vie étudiante (clubs, adhésions, événements) | Spring Boot | 4005 | MongoDB |
| **Assistant IA** | Python, FastAPI, Pydantic AI, Gemini | 4010 | MongoDB (option) |
| Interface | React 19, Vite, TypeScript, Tailwind | 5173 | |

Huit applications, **cinq technologies**, une interface commune. La diversité est volontaire : chaque module est développé et déployable seul, et ne communique avec les autres que par HTTP et par jetons.

---

## 2. Architecture

```
                    ┌──────────────────────────────────────────────┐
  Navigateur  ────► │ Front React (5173)  |  en ligne : Vercel     │
  cookie httpOnly   │ un client HTTP unique, routage par préfixe   │
                    └───────┬──────────────────────────────────────┘
                            │ chaque requête porte le cookie sc_access (ou un Bearer)
   ┌────────┬───────────┬───┴──────┬───────────┬────────────┬──────────┐
   ▼        ▼           ▼          ▼           ▼            ▼          ▼
 Utilisateurs  Académique  Ressources  Résidences   Bibliothèque  Vie étud.  Agent IA
 (4001)        (8081)      (8080)      passerelle   (8082)        (4005)     (4010)
 émet les      │           │           (3001)       │             │          │
 jetons        └─ chaque service VÉRIFIE lui-même le jeton (signature, ├──► microservices internes
                  émetteur, audience, expiration) et applique ses règles    (3011-3013, clé interne)
                                                                       RabbitMQ (événements métier)
```

### Principes

1. **Une seule source d'identité** : le user-service signe les jetons (JWT). Les autres services les **vérifient localement**, sans appeler le user-service.
2. **Jeton en cookie `httpOnly`** (`sc_access`, `sc_refresh`) : le JavaScript de la page ne voit jamais le jeton ; une faille XSS ne peut pas le voler.
3. **Chaque service est l'autorité finale** sur ses propres données. L'interface cache des boutons par confort, mais ne protège rien : c'est le serveur qui refuse.
4. **Aucun couplage fort** : les modules ne partagent ni base ni code. Les événements métier (compte créé, etc.) passent par RabbitMQ.
5. **Routage par préfixe dans le front** (`src/shared/api/client.ts`) : `/auth`, `/users` → utilisateurs ; `/rooms`, `/reservations` → ressources ; `/chambres`… → résidences ; `/books`, `/loans` → bibliothèque ; `/clubs`, `/events`, `/memberships`, `/reports` → vie étudiante ; le reste → académique. Un test (`client.routes.test.ts`, 14 cas) garde ce routage.

---

## 3. Parcours type : de la connexion à une donnée

1. L'utilisateur saisit e-mail et mot de passe. `POST /auth/login` : le service compare le hash **bcrypt**, compte les échecs (verrouillage 15 minutes après 5), exige un e-mail **vérifié**.
2. Il répond avec deux cookies `httpOnly`, `SameSite=Strict`, `Secure` en production : un jeton d'accès court (2 h) et un jeton de rafraîchissement à **rotation**.
3. Le front appelle un module (ex. `GET /api/rooms`) avec `credentials: include` et l'en-tête `X-Auth-Mode: cookie`.
4. Le service lit le cookie, vérifie **signature, expiration, émetteur et audience**, extrait le rôle, puis applique ses règles (rôle, propriétaire).
5. Pour une **écriture par cookie**, il exige aussi `X-Auth-Mode: cookie` **et** une origine autorisée : sinon 403 (protection CSRF).
6. Jeton expiré : le front appelle `/auth/refresh` ; l'ancien jeton de rafraîchissement est invalidé (rotation). Un jeton rejoué révoque toute la famille de sessions.

---

## 4. Sécurité

### 4.1 Les couches

| Couche | Mesure | Où |
|---|---|---|
| Mots de passe | bcrypt ; politique de complexité ; mot de passe temporaire à changer | user-service |
| Connexion | réponse identique pour tous les échecs (pas d'énumération de comptes), verrouillage 15 min après 5 échecs, limite de débit (10 tentatives par 15 min), e-mail vérifié par code à 6 chiffres | user-service |
| Jetons | HS256 (développement) ; **RS256 + clé publique publiée (JWKS)** en production ; rotation des jetons de rafraîchissement, rejeu détecté, déconnexion globale, révocation | user-service |
| Navigateur | cookies `httpOnly`, `SameSite=Strict`, `Secure` ; en-têtes de sécurité (CSP, HSTS…) | user-service |
| CSRF | `X-Auth-Mode: cookie` + origine en liste blanche, sur toute écriture par cookie | tous les services |
| CORS | **origines précises** (`CORS_ORIGINS`), jamais `*` avec des cookies | tous les services |
| Rôles | contrôlés **côté serveur**, par route | tous les services (§4.2) |
| Production | démarrage **refusé** si secret par défaut, mot de passe admin faible, cookies non `Secure`, clé RSA absente | user-service, ressources, académique, agent |
| Agent IA | rôle lu dans le jeton, outils cachés selon les droits, écriture après clic, RAG filtré par rôle | `DOCUMENT-AGENT-IA.md` |

### 4.2 Qui peut faire quoi (état vérifié le 9 novembre)

| Module | Lecture | Écriture |
|---|---|---|
| Utilisateurs | son propre profil ; liste : admin | rôles, statuts, suppression : admin |
| Académique | catalogue et planning : tout utilisateur connecté ; **notes et absences : l'étudiant concerné ou le personnel** | cours, groupes, salles, séances, planification, années : admin ; notes, absences, fichiers : enseignant ou admin ; inscriptions : étudiant (demande), admin (décision) |
| Ressources | salles et réservations : tout utilisateur connecté (`scope=all` : admin) | réserver : enseignant ou admin ; valider ou refuser : admin ; annuler : le demandeur ou un admin |
| Résidences | chambres : tout utilisateur connecté ; contrats (liste) : admin | chambres : admin ; demandes : étudiant propriétaire ; décisions : admin |
| Bibliothèque | catalogue, ses emprunts : tout utilisateur connecté ; liste des prêts : admin | ajouter un livre : admin ; emprunter, réserver : utilisateur connecté |
| Vie étudiante | **catalogue des clubs et des événements : public (sans connexion), par conception** ; ses adhésions : connecté | créer ou supprimer un club, décider d'une adhésion : admin ; adhérer, s'inscrire : connecté |
| Agent IA | tout utilisateur connecté, outils selon le rôle | proposer un changement de téléphone, exécuté après clic |

### 4.3 L'audit du 9 novembre : ce qu'on a trouvé et corrigé

Un contrôle réel (requêtes sans jeton, avec un jeton étudiant, avec une identité forgée) a révélé des failles **dans des modules qui paraissaient fonctionner**. Elles ont été corrigées, chacune avec des tests qui échouent sans la correction.

| Module | Faille constatée | Correction |
|---|---|---|
| Bibliothèque | ignorait le cookie de session ; sans en-tête, traitait **tout le monde comme une étudiante par défaut** ; acceptait `X-User-Role: admin` envoyé par n'importe qui ; CORS ouvert | cookie `sc_access` lu ; 401 sans jeton ; identité par en-têtes désactivée sauf `AUTH_ALLOW_INSECURE_IDENTITY=true` ; signature, émetteur, audience vérifiés ; CSRF ; CORS limité (16 tests) |
| Ressources | **aucune authentification** : n'importe qui lisait, réservait, validait, refusait ; identité par en-têtes avec défauts (« Karim Trabelsi », enseignant) | JWT obligatoire, rôles par route, identité prise dans le jeton, CSRF, CORS, secret de production (21 tests) |
| Résidences | un **jeton de démonstration non signé** était accepté comme admin ; les 3 microservices internes répondaient à tout le monde (données des étudiantes comprises) ; CORS reflétait n'importe quelle origine | jeton de démonstration refusé par défaut ; **clé interne** `X-Internal-Key` exigée par les microservices (comparaison en temps constant), écoute locale par défaut ; CORS limité (75 tests) |
| Académique | authentification présente, mais **aucun contrôle de rôle** : un étudiant pouvait supprimer un cours ou modifier des notes ; CORS ouvert ; émetteur et audience non vérifiés | règles par URL et par propriétaire, CSRF, CORS limité, émetteur et audience vérifiés (34 tests) |

Cet audit est aussi ce qui rend l'agent crédible : il relaie le jeton de l'utilisateur, donc il n'est sûr que si les services le sont.

---

## 5. Données et événements

- **Une base par module** (MongoDB, PostgreSQL à schémas séparés, H2, SQLite) : aucune jointure entre modules.
- **Événements métier** : le user-service écrit chaque événement dans une **boîte d'envoi (outbox)** en base, puis un relais le publie vers RabbitMQ (confirmations, reconnexion automatique, reprise avec délai croissant, identifiant unique par message). Si RabbitMQ tombe, l'API continue de répondre et les événements partent au retour du courtier, dans l'ordre. Vérifié contre un vrai RabbitMQ.
- **Résidences** : le service Demandes publie, le service Contrats consomme (file durable `residences.contrats.events`) : l'approbation d'une demande crée un contrat.
- **Limite connue de l'outbox** : sans MongoDB en réplica set, l'écriture de l'événement n'est pas atomique avec celle du compte (fenêtre de quelques millisecondes). Les consommateurs doivent dédupliquer sur l'identifiant du message.

---

## 6. L'assistant IA (résumé)

Un bouton dans toute l'application. Il lit le profil, le règlement (RAG filtré par rôle) et, en lecture seule, les cours, salles, chambres, livres, emprunts, clubs et événements. Il ne peut **proposer** qu'un changement de téléphone, exécuté après clic. Il n'a aucun droit propre : chaque appel porte le jeton de l'utilisateur. Évaluation adverse sur le vrai modèle : 9 cas sur 9 (7 novembre). Détail complet : `DOCUMENT-AGENT-IA.md`.

---

## 7. Exploitation et déploiement

- **Observabilité du user-service** : journaux JSON avec identifiant de requête, métriques Prometheus (`/metrics`, jeton obligatoire), traces OpenTelemetry (désactivées par défaut), `/health` et `/ready`, arrêt progressif.
- **Conteneurs** : images Docker non-root pour le user-service, l'agent et la vie étudiante ; `docker-compose` pour PostgreSQL, RabbitMQ et les résidences.
- **En ligne (offres gratuites, sans carte)** : front sur **Vercel**, user-service et agent sur **Render**, base sur **MongoDB Atlas**. Vercel relaie `/svc/user/*` et `/svc/agent/*` vers Render : le navigateur ne voit qu'**une seule origine**, ce qui garde les cookies valides sans domaine propre. Lien : <https://user-gestioncd-gestionrc-eight.vercel.app>.
- **Vérifié en ligne** : connexion admin, cookie, assistant (profil). **Non vérifié en ligne** : envoi de l'e-mail avec code (Render bloque peut-être le SMTP de Gmail).

---

## 8. Qualité

| Projet | Tests | Résultat |
|---|---|---|
| Utilisateurs (Node) | 85 | tous passent |
| Académique (Spring) | 34 | tous passent |
| Ressources (Spring) | 21 | tous passent |
| Résidences (NestJS) | 75 | tous passent |
| Bibliothèque (FastAPI) | 16 | tous passent |
| Agent IA (Python) | 95 | tous passent |
| Front (React) | 58 | tous passent |
| **Total** | **384** | |

Couverture du user-service mesurée le 2 novembre (74 tests alors) : 96,9 % des lignes, 88,2 % des branches. Vérifications dans un **navigateur réel automatisé** (Edge sans interface) : connexion, six modules, ajout d'un livre, validation d'une réservation, assistant. Dépôt d'intégration : branche `integration-final`.

**Intégration continue : non active.** Les fichiers `ci.yml` existent mais sont dans les sous-dossiers ; GitHub ne lit que `.github/workflows` à la racine. Aucune exécution n'a eu lieu sur les deux dépôts. À corriger par un workflow racine.

---

## 9. Limites et reste à faire

1. **Mise en ligne partielle** : seuls utilisateurs et agent sont en ligne ; les cinq autres modules tournent en local (étape 2). Avant de les mettre en ligne, il faut leur faire lire la **clé publique (JWKS, RS256)** : aujourd'hui ils vérifient avec un secret partagé (HS256), alors que le user-service de production signe en RS256.
2. **Pas de double authentification** (2FA).
3. **Identifiants numériques dérivés** : l'académique dérive l'identifiant de l'étudiant des chiffres du jeton (`ETU-2026-0002` et `ADM-2026-0002` donnent le même nombre). Convention héritée des données ; à remplacer par l'identifiant texte.
4. **Données en mémoire** : le service Ressources (H2) repart à zéro à chaque redémarrage.
5. **Pas d'API Gateway unique** : le front connaît chaque service ; la passerelle existe seulement pour les résidences.
6. **Intégration continue inactive** (§8).
7. **Modules à finaliser côté données** : la liste de chambres est vide à l'origine ; six fichiers du module Résidences existent sur d'autres branches mais pas dans la branche d'intégration (non repris, rôle exact à confirmer avec leur auteur).
8. **Vérification humaine** : l'interface a été contrôlée par navigateur automatisé, pas encore par un utilisateur sur plusieurs écrans (mobile, clavier, lecteur d'écran) ; la voix n'a pas été écoutée dans le navigateur.
9. **E-mail en ligne** non vérifié (§7).

---

## 10. Questions et réponses

### A. Architecture et choix

**Pourquoi une architecture microservices pour un campus ?**
Les modules ont des cycles de vie, des équipes et des technologies différents (ici cinq). Chacun peut être développé, testé, déployé et mis à l'échelle sans toucher aux autres, et une panne de la bibliothèque n'arrête pas les connexions. Le prix est la complexité : authentification partagée, routage, cohérence des règles ; c'est précisément ce que ce projet a dû résoudre.

**Pourquoi des technologies différentes ?**
Chaque équipe a utilisé ce qu'elle maîtrise ; la plateforme n'impose que deux contrats : HTTP et JWT. C'est aussi ce qui a révélé les écarts (cookie ignoré, rôles absents) : on ne peut pas supposer qu'un service « fait comme les autres ».

**Pourquoi pas une API Gateway unique ?**
Elle n'a pas été construite : le front choisit le service par préfixe d'URL. C'est une limite assumée. Seules les résidences ont une passerelle, qui centralise JWT, rôles et proxy vers leurs trois microservices.

**Comment les services communiquent-ils ?**
Par HTTP avec le jeton de l'utilisateur pour les requêtes, et par événements RabbitMQ pour les faits métier (outbox côté utilisateurs ; file durable côté résidences).

**Pourquoi chaque service vérifie-t-il lui-même le jeton ?**
Pour ne dépendre ni du réseau ni d'un point central : la vérification est locale (signature, émetteur, audience, expiration). Le user-service peut tomber sans bloquer les modules tant que les jetons sont valides.

### B. Sécurité

**Pourquoi des cookies `httpOnly` et pas un jeton dans le navigateur ?**
Un jeton lisible par JavaScript est volé par la moindre faille XSS. Un cookie `httpOnly` n'est jamais lisible par le script ; le front ne manipule aucun jeton.

**Et le CSRF, puisque le cookie part tout seul ?**
Trois protections cumulées : cookie `SameSite=Strict` ; en-tête personnalisé `X-Auth-Mode: cookie` (qu'un site tiers ne peut pas ajouter sans préflight CORS) ; **origine en liste blanche** vérifiée côté serveur sur toute écriture. Testé dans chaque service (écriture refusée sans l'en-tête ou depuis `pirate.example`).

**Pourquoi RS256 en production et HS256 en développement ?**
HS256 : un secret partagé, simple, mais tout service qui le connaît peut **fabriquer** des jetons. RS256 : le user-service signe avec une clé privée qu'il garde, les autres vérifient avec la clé **publique** (JWKS) : aucun secret à partager. Les modules qui vérifient encore en HS256 devront être adaptés avant la mise en ligne (limite n°1).

**Comment évitez-vous qu'un étudiant se fasse passer pour un administrateur ?**
Le rôle vient du **jeton signé**, jamais d'une saisie ni d'un en-tête. Les anciens en-têtes `X-User-*` ont été supprimés ou neutralisés ; un test envoie `X-User-Role: admin` et vérifie le refus.

**Qu'avez-vous découvert à l'audit, et qu'en avez-vous fait ?**
Quatre modules n'étaient pas sûrs alors qu'ils fonctionnaient (§4.3) : service sans authentification, identité par défaut, jeton de démonstration, absence de contrôle de rôle. Corrigés et testés. Nous le disons parce que c'est la preuve d'une démarche : on teste les refus, pas seulement les succès.

**Un étudiant peut-il lire les notes d'un autre ?**
Non : l'accès à `/notes/etudiant/{id}` et aux absences est réservé à l'étudiant concerné ou au personnel (10 tests de rôles). Limite : l'identifiant numérique est dérivé du `sub` (§9, n°3).

**Que se passe-t-il si on devine l'adresse d'un microservice interne ?**
Les microservices des résidences exigent une clé interne que seule la passerelle possède ; sans elle, 401. Ils n'écoutent que la boucle locale par défaut. Avant, ils répondaient à tout le monde.

**Comment protégez-vous les mots de passe et les comptes ?**
bcrypt, politique de complexité, verrouillage temporaire, limite de débit, réponse unique pour tous les échecs, vérification d'e-mail, mot de passe temporaire à changer, rotation des jetons de rafraîchissement.

**Y a-t-il une double authentification ?**
Non. Le code à 6 chiffres vérifie l'adresse à l'inscription, pas chaque connexion. C'est une amélioration identifiée.

**La vie étudiante est lisible sans connexion : est-ce une faille ?**
C'est un choix de conception : le catalogue des clubs et des événements est public. Adhérer, s'inscrire, voir ses adhésions et administrer exigent une connexion et le bon rôle.

### C. Données et événements

**Qu'est-ce que l'outbox, et pourquoi ?**
On écrit l'événement dans la base en même temps que la donnée, puis un relais le publie. Ainsi, une panne de RabbitMQ ne perd rien et ne bloque pas l'API. Limite : sans réplica MongoDB, les deux écritures ne sont pas atomiques.

**Que se passe-t-il si RabbitMQ tombe ?**
L'API répond normalement ; les événements s'accumulent en base et partent, dans l'ordre, au retour du courtier. Vérifié en coupant et relançant un vrai RabbitMQ.

**Pourquoi plusieurs bases ?**
Pour qu'un module reste autonome : pas de jointure, pas de migration commune. Le prix : pas de transaction entre modules, d'où les événements.

### D. Agent IA

**Qu'est-ce qui rend l'agent sûr ?**
Il n'a aucun droit propre (il relaie le jeton de l'utilisateur), les outils interdits lui sont cachés, il ne peut qu'**proposer** une écriture, et les services restent l'autorité finale. La sécurité ne dépend pas de la bonne volonté du modèle.

**Peut-il se tromper ?**
Oui, comme tout modèle. Atténuations : il ne connaît que ce que renvoient ses outils, il cite ses sources, il dit « non publié » plutôt que d'inventer, et une évaluation adverse (9 cas) vérifie les tentatives de manipulation.

**Les données de l'utilisateur partent-elles chez un tiers ?**
Oui : la question et les résultats d'outils sont envoyés au fournisseur du modèle (Google, offre gratuite). Il faut vérifier ses conditions avant un usage réel. Le modèle se change par simple configuration.

### E. Déploiement

**Comment est-ce déployé, et à quel coût ?**
Front sur Vercel, user-service et agent sur Render, base sur MongoDB Atlas : offres gratuites, sans carte. Vercel relaie les appels vers Render pour que le navigateur ne voie qu'une origine et que les cookies restent valides.

**Pourquoi tous les modules ne sont-ils pas en ligne ?**
Les offres gratuites limitent la mémoire (512 Mo) et les services s'endorment ; les modules Java et la pile des résidences (4 services, PostgreSQL, RabbitMQ) sont les plus lourds. Ils sont prévus à l'étape 2, après adaptation à la clé publique (JWKS).

**Que se passe-t-il au premier appel après une pause ?**
Le service gratuit se réveille : 30 à 60 secondes. Prévoir un « réveil » avant une démonstration.

### F. Qualité et méthode

**Comment prouvez-vous que ça marche ?**
384 tests automatiques, plus des essais dans un navigateur réel automatisé (connexion, six modules, ajout d'un livre, validation d'une réservation, assistant). Chaque faille corrigée a des tests qui échouaient avant.

**Pourquoi tester les refus ?**
Un test qui vérifie seulement qu'un administrateur réussit ne prouve rien sur la sécurité. Les tests envoient des requêtes sans jeton, avec un jeton étudiant, forgé, d'une autre audience, ou depuis une autre origine, et vérifient 401 ou 403.

**Y a-t-il de l'intégration continue ?**
Elle est écrite mais **inactive** : les fichiers sont dans des sous-dossiers que GitHub ne lit pas. C'est un point à corriger, et nous le disons.

**Comment avez-vous organisé les branches ?**
Une branche d'intégration, `integration-final`, regroupe tous les modules ; elle est publiée dans le dépôt de l'équipe et dans le fork. La branche `main` n'a pas encore ce travail : une pull request est à faire.

### G. Questions pièges

**« C'est juste du CRUD, non ? »**
Les écrans de gestion le sont, comme dans toute application. Ce qui ne l'est pas : authentification complète (rotation des jetons avec détection de rejeu, verrouillage, vérification d'e-mail, RS256 et JWKS), autorisation par rôle et par propriétaire dans cinq technologies, événements asynchrones avec outbox, observabilité, conteneurs, et un agent IA avec RAG filtré par rôle, outils typés, confirmation à usage unique et évaluation adverse.

**« Tout est-il en ligne ? »**
Non. En ligne : utilisateurs et agent (profil, règlement). Les autres modules tournent en local et sont prévus à l'étape 2.

**« Vos modules étaient-ils sûrs dès le départ ? »**
Non, et c'est ce que l'audit a montré : quatre modules avaient des failles réelles. Elles sont corrigées et testées ; le user-service, lui, avait déjà fait l'objet d'un audit complet.

**« Qu'est-ce qui vous manque pour la production ? »**
La lecture de la clé publique par tous les modules, une API Gateway ou un routage unique, la double authentification, une intégration continue active, la vérification de l'envoi des e-mails en ligne, et l'hébergement des cinq autres modules.

**« Si vous deviez recommencer ? »**
Définir dès le début un contrat de sécurité commun (cookie ou Bearer, rôles, CSRF, CORS) avec des tests partagés pour chaque module, et une passerelle unique : l'audit a coûté des corrections dans quatre services qui auraient été évitées.

---

## 11. Démonstration conseillée (10 minutes)

1. Montrer le dépôt et la structure (`GUIDE-LANCEMENT-ET-TESTS.md` §1).
2. Se connecter en **admin** : parcourir les six modules ; valider une réservation ; ajouter un livre.
3. Se connecter en **étudiant** : mêmes pages sans actions d'administration.
4. Ouvrir l'**assistant** : profil, cours, clubs ; changement de téléphone avec **Confirmer** ; puis, en étudiant, « donne-moi le profil de ADM-2026-0001 » → refus.
5. Montrer un **refus côté serveur** (étudiant sur une route admin : 403) et les tests (`npm test`, `pytest`).
6. Montrer le **lien en ligne** (connexion, assistant) et dire clairement ce qui n'y est pas encore.
