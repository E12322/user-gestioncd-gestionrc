# Module 4 — Résidences

**Microservice back-end : `housing-service`** · Rôles : étudiant, administrateur (pas d'accès enseignant).

## Dossiers

```
housing/
├─ index.ts        ModuleDef (route /residences, rôles student + admin)
├─ api/            fonctions d'API du housing-service (+ mock de chaque route)
├─ mocks/          résidences, chambres générées, demandes, signalements, base en mémoire
├─ hooks/          useViewer, useResidences, useMyRequest, useRequests, useAvailableRooms, useTickets
├─ types/          Residence, HousingRoom, HousingRequest, Ticket…
├─ schemas/        validation des étapes de la demande et du signalement de panne
├─ utils/          time.ts : dates locales et mise en forme
├─ i18n/           textes français
├─ components/     ResidenceCard, RoomPicker, HousingRequestStepper, OccupancyChart, TicketStatusBadge
└─ pages/          HousingModule (onglets), ResidencesPage, MyRequestPage, RequestsPage, MaintenancePage
```

## Pages (front)

| Route                     | Accès           | Écran                                                                     |
| ------------------------- | --------------- | ------------------------------------------------------------------------- |
| `/residences`             | étudiant, admin | Résidences, jauge de lits ; graphique d'occupation (admin)                |
| `/residences/ma-demande`  | étudiant        | Demande en 4 étapes (Stepper), puis suivi (Timeline), annulation possible |
| `/residences/demandes`    | admin           | File des demandes : affecter une chambre ou refuser                       |
| `/residences/maintenance` | étudiant, admin | Signaler une panne · l'admin la traite (Signalé → En cours → Résolu)      |

## Routes de l'API

| Route                               | Qui                                | Corps → Réponse                                                                          | Erreurs                                                      |
| ----------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /residences`                   | étudiant, admin                    | `Residence[]` (avec `capacity` et `occupied` en lits)                                    | 403 enseignant                                               |
| `GET /residences/{id}/rooms?type=`  | admin                              | chambres avec au moins un lit libre                                                      | 403 · 404                                                    |
| `GET /housing-requests/me`          | étudiant                           | dernière demande ou `null`                                                               | 403                                                          |
| `POST /housing-requests`            | étudiant                           | `{residenceId,roomType,entryDate,durationMonths,accessibility,notes}` → `HousingRequest` | 409 `RESIDENCE_FULL` · `ALREADY_REQUESTED` · 422 date passée |
| `DELETE /housing-requests/{id}`     | étudiant (la sienne, en attente)   | —                                                                                        | 403 · 404 · 409 déjà traitée                                 |
| `GET /housing-requests`             | admin                              | `HousingRequest[]`                                                                       | 403                                                          |
| `PUT /housing-requests/{id}/assign` | admin                              | `{roomId}` → demande « confirmée » + chambre                                             | 409 `RESIDENCE_FULL` · `ROOM_FULL` · `ALREADY_DECIDED`       |
| `PUT /housing-requests/{id}/refuse` | admin                              | —                                                                                        | 404 · 409                                                    |
| `GET /tickets`                      | étudiant (les siens), admin (tous) | `Ticket[]`                                                                               | —                                                            |
| `POST /tickets`                     | étudiant                           | `{residenceId,location,category,description}`                                            | 422                                                          |
| `PUT /tickets/{id}/status`          | admin                              | `{status: open\|in_progress\|resolved}`                                                  | 403 · 404                                                    |

## Événements de domaine publiés

`DemandeDéposée` · `ChambreAffectée`.

## Règles métier

- Résidence pleine : la demande est refusée en **409** ; l'admin peut réorienter vers une autre résidence à l'affectation.
- Un étudiant n'a qu'une demande active (en attente ou affectée) ; après un refus il peut en déposer une nouvelle.
- Une chambre individuelle a 1 lit, une chambre double 2 ; l'occupation de la résidence est la somme des lits occupés.
- Il n'y a pas de rôle « Technicien » : l'administrateur traite les pannes.

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] Contrôle du rôle (403 pour un enseignant) et de la propriété de la demande
- [ ] Affectation atomique (une chambre et un lit ne sont affectés qu'une fois)
- [ ] Événements `DemandeDéposée`, `ChambreAffectée` publiés
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
