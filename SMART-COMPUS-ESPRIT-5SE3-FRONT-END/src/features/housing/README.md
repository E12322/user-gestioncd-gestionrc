# Module 4 — Résidences

**Microservices back-end : Chambre, Demande, Contrat (NestJS)** · Rôles : étudiant, administrateur (pas d'accès enseignant).

## Dossiers

```
housing/
├─ index.ts        ModuleDef (route /residences, rôles student + admin)
├─ api/            appels aux routes NestJS (/chambres, /demandes, /contrats) + mocks des mêmes règles
├─ mocks/          base en mémoire (chambres, demandes, contrats, tickets de maintenance)
├─ hooks/          useViewer, useChambres, useChambresDisponibles, useDemandes, useContrats…
├─ types/          Chambre, Demande, Contrat, Ticket… + constantes (types, tarifs, capacités)
├─ schemas/        validation zod des formulaires (demande, chambre, signalement)
├─ utils/          time.ts (dates locales), students.ts (noms d'affichage)
├─ i18n/           textes français
├─ components/     ChambreCard, ChambrePicker, ChambreFormDialog, BatimentOccupancy, badges
└─ pages/          HousingModule (onglets), ResidencesPage (vue d'ensemble), ChambresPage,
                   DemandesPage, NewDemandePage, ContratsPage, MaintenancePage
```

## Pages (front)

| Route                      | Accès           | Écran                                                                                         |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `/residences`              | étudiant, admin | Vue d'ensemble : disponibilité, occupation par bâtiment, demandes en attente, contrats actifs |
| `/residences/chambres`     | étudiant, admin | Liste des chambres ; filtres type / bâtiment / disponibilité ; CRUD admin                     |
| `/residences/demandes`     | étudiant        | Mes demandes : suivi, annulation possible (En attente ou Approuvée)                           |
| `/residences/demandes`     | admin           | File des demandes : approuver (choix d'une chambre libre) ou refuser                          |
| `/residences/demandes/new` | étudiant        | Formulaire : date d'arrivée, date de départ, chambre souhaitée (facultatif)                   |
| `/residences/contrats`     | étudiant        | Détail de mes contrats (chambre, période, loyer, statut)                                      |
| `/residences/contrats`     | admin           | Tous les contrats, résiliation possible (libère la chambre)                                   |
| `/residences/maintenance`  | étudiant, admin | Signaler une panne · l'admin la traite (Signalé → En cours → Résolu)                          |

## Routes de l'API (NestJS)

| Route                                         | Qui                                              | Corps → Réponse                                                 | Erreurs                                                   |
| --------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------- |
| `GET /chambres?type=&batiment=&disponible=`   | étudiant, admin                                  | `Chambre[]`                                                     | —                                                         |
| `GET /chambres/disponibles?type=&batiment=`   | étudiant, admin                                  | `Chambre[]`                                                     | —                                                         |
| `POST /chambres`                              | admin                                            | `ChambreInput` → `Chambre`                                      | 400 capacité incohérente · 409 doublon (bâtiment, numéro) |
| `PATCH /chambres/{id}`                        | admin                                            | `Partial<ChambreInput>` → `Chambre`                             | 404 · 409                                                 |
| `DELETE /chambres/{id}`                       | admin                                            | —                                                               | 404                                                       |
| `GET /demandes?statut=&etudiantId=`           | étudiant (les siennes), admin (toutes)           | `Demande[]`                                                     | —                                                         |
| `GET /demandes/{id}`                          | étudiant, admin                                  | `Demande`                                                       | 404                                                       |
| `POST /demandes`                              | étudiant                                         | `{etudiantId, dateArrivee, dateDepart, chambreId?}` → `Demande` | 422 dates invalides · 404 chambre                         |
| `PATCH /demandes/{id}/statut`                 | admin (approbation/refus), étudiant (annulation) | `{statut, chambreId?}` → `Demande`                              | 409 transition interdite · 409 chambre déjà occupée       |
| `GET /contrats?statut=&residentId=`           | admin                                            | `Contrat[]`                                                     | —                                                         |
| `GET /contrats/resident/{residentId}?statut=` | étudiant (les siens), admin                      | `Contrat[]`                                                     | 403                                                       |
| `GET /contrats/{id}`                          | étudiant, admin                                  | `Contrat`                                                       | 404                                                       |
| `PATCH /contrats/{id}/resilier`               | admin                                            | — → `Contrat`                                                   | 404 · 409 contrat non actif                               |

## Événements de domaine publiés

`DemandeDéposée` · `DemandeApprouvée` · `ContratCréé` · `ContratRésilié` · `DemandeRefusée` / `DemandeAnnulée`.

## Règles métier

- Une chambre n'accueille qu'un résident à la fois : l'occupation est atomique (`UPDATE … WHERE disponible = true` côté back).
- `dateArrivee` strictement antérieure à `dateDepart` ; `dateDepart` ne peut pas dépasser le 31 juillet de l'année académique (400 sinon) ; une approbation nécessite une chambre libre.
- Un étudiant n'a qu'une **demande active** à la fois (`EN_ATTENTE` ou `APPROUVEE`) : un nouveau dépôt renvoie 409 tant que l'active n'est pas `REFUSEE`/`ANNULEE` — donc jamais deux chambres simultanées.
- Transitions : `EN_ATTENTE → APPROUVEE | REFUSEE | ANNULEE`, `APPROUVEE → ANNULEE` (libère la chambre et résilie le contrat).
- Contrat créé automatiquement à l'approbation : loyer mensuel par type (SIMPLE 150 · DOUBLE 100 · STUDIO 200 TND), `dateFin` ≤ 31 juillet de l'année académique, un contrat par demande.
- Capacités par type : SIMPLE = 1, DOUBLE = 2, STUDIO ≤ 2.
- La maintenance (signalements) est un service mocké, hors périmètre Chambre/Demande/Contrat.

## Brancher le front sur le back-end

```bash
# backend-residences/ (racine du monorepo) — 4 applications NestJS
# passerelle :3001 (JWT + proxy) · chambres :3011 · demandes :3012 · contrats :3013
# Prérequis : PostgreSQL + RabbitMQ démarrés.
cd backend-residences
npm run seed        # jeu de données de démo, via l'API de la passerelle (idempotent)
npm run start:dev   # les 4 services en parallèle (gateway Swagger : http://localhost:3001/api/docs)
```

Architecture : la passerelle vérifie le JWT, applique les rôles, puis proxifie vers les
microservices (un schéma PostgreSQL chacun). L'approbation d'une demande publie
`demande.approuvee` sur la file durable RabbitMQ `residences.contrats.events` ; le service
Contrats y crée le contrat — même s'il était arrêté au moment de l'approbation.

Puis, dans le `.env` du front-end (monorepo) :

```
VITE_USE_MOCKS=false
VITE_RESIDENCES_API_BASE_URL=http://localhost:3001/api
VITE_REAL_API_PREFIXES=/chambres,/demandes,/contrats
```

Le client API route chaque préfixe vers son microservice (`SERVICE_ROUTES` de `shared/api/client.ts`) :
seules les routes `/chambres`, `/demandes`, `/contrats` pointent vers le service Résidences,
les autres modules restent en mode fictif tant que leurs services ne tournent pas.

> **Connexion en mode hybride** : avec `VITE_USE_MOCKS=false`, le sélecteur de rôle de démo
> disparaît (`TopBar` l'affiche uniquement en mode fictif) mais l'authentification reste simulée
> tant que `/auth` n'est pas dans `VITE_REAL_API_PREFIXES`. Utilisez les comptes de démo du module
> Utilisateurs : `yasmine.bensalah@gmail.com` (étudiant), `sonia.gharbi@gmail.com` (admin),
> `karim.trabelsi@gmail.com` (enseignant) — mot de passe commun `Campus2026!`, code e-mail `123456`.

En mode mock (par défaut), les pages fonctionnent sans back-end grâce à `api/` + `mocks/`.
