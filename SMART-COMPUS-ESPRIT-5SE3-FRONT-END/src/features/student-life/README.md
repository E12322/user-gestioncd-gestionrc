# Module 5 — Vie étudiante & clubs

**Microservice back-end : `club-service`** · Rôles : étudiant, enseignant, administrateur.

## Dossiers

```
student-life/
├─ index.ts        ModuleDef (route /vie-etudiante)
├─ api/            fonctions d'API du club-service (+ mock de chaque route)
├─ mocks/          clubs, adhésions, événements, base en mémoire
├─ hooks/          useViewer, useClubs, useClub, useEvents, useMemberships
├─ types/          Club, Membership, CampusEvent, ClubInput, EventInput
├─ schemas/        validation des formulaires de club et d'événement
├─ utils/          time.ts : dates locales, créneaux de 30 min
├─ i18n/           textes français
├─ components/     ClubCard, EventCard, MembershipButton, useMembership, ClubForm, EventForm, Field
└─ pages/          StudentLifeModule (onglets), ClubsPage, ClubDetailPage, EventsPage, ClubAdminPage
```

## Pages (front)

| Route                      | Accès | Écran                                                    |
| -------------------------- | ----- | -------------------------------------------------------- |
| `/vie-etudiante`           | tous  | Annuaire des clubs, recherche, catégorie, adhésion       |
| `/vie-etudiante/clubs/:id` | tous  | Fiche du club : membres, événements à venir              |
| `/vie-etudiante/agenda`    | tous  | Événements à venir, regroupés par jour                   |
| `/vie-etudiante/gestion`   | admin | Créer un club, créer un événement, valider les adhésions |

## Routes de l'API

| Route                           | Qui                  | Corps → Réponse                                                | Erreurs                                         |
| ------------------------------- | -------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `GET /clubs?q=&category=`       | tous                 | `ClubView[]` (avec `myMembership`)                             | —                                               |
| `GET /clubs/{id}`               | tous                 | `ClubDetail` (membres confirmés, événements à venir)           | 404                                             |
| `POST /clubs`                   | admin                | `{name,category,description,meetingPlace,maxMembers}` → `Club` | 403 · 409 `CLUB_EXISTS`                         |
| `POST /clubs/{id}/members`      | étudiant, enseignant | — → `Membership` (en attente)                                  | 403 admin · 409 `ALREADY_MEMBER` / `CLUB_FULL`  |
| `DELETE /clubs/{id}/members/me` | étudiant, enseignant | retire la demande ou quitte le club                            | 404                                             |
| `GET /memberships`              | admin                | `Membership[]`                                                 | 403                                             |
| `PUT /memberships/{id}/status`  | admin                | `{status: confirmed\|refused}`                                 | 403 · 404 · 409 `ALREADY_DECIDED` / `CLUB_FULL` |
| `GET /events?clubId=`           | tous                 | événements à venir                                             | —                                               |
| `POST /events`                  | **admin seulement**  | `{title,description,date,start,end,location,clubId?}`          | 403 · 422                                       |

## Événements de domaine publiés

`ClubCréé` · `AdhésionConfirmée`.

## Règles métier

- **Seul l'administrateur crée des clubs et des événements** ; il n'y a pas de rôle « responsable de club ».
- Une adhésion est « en attente » jusqu'à la validation de l'admin ; l'effectif ne compte que les adhésions confirmées.
- Club complet (`members ≥ maxMembers`) : 409 à la demande et à la confirmation.
- L'administrateur gère les clubs : il ne peut pas y adhérer (403).

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] Contrôle du rôle (création de club et d'événement : admin seulement)
- [ ] Événements `ClubCréé`, `AdhésionConfirmée` publiés
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
