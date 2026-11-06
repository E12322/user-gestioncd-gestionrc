# Module 3 — Ressources

**Microservice back-end : `resource-service`** · Rôles : enseignant, administrateur (les étudiants n'ont pas accès).

## Dossiers

```
resources/
├─ index.ts        ModuleDef (route /ressources, rôles teacher + admin)
├─ api/            fonctions d'API du resource-service (+ mock de chaque route)
├─ mocks/          salles, équipements, réservations, base en mémoire
├─ hooks/          useViewer, useRooms, useAvailability, useReservations
├─ types/          Room, Equipment, Reservation, Availability, heures d'ouverture
├─ schemas/        validation du formulaire de réservation
├─ utils/          time.ts : dates locales, chevauchement de créneaux, créneaux de 30 min
├─ i18n/           textes français
├─ components/     RoomCard, EquipmentList, AvailabilityCalendar, ReservationForm
└─ pages/          ResourcesModule (onglets), RoomsPage, ReservationsPage, ReservationRequestPage, ApprovalsPage
```

## Pages (front)

| Route                          | Accès             | Écran                                                  |
| ------------------------------ | ----------------- | ------------------------------------------------------ |
| `/ressources`                  | enseignant, admin | Salles : recherche, bâtiment, capacité, disponibilités |
| `/ressources/mes-reservations` | enseignant, admin | Mes réservations et suivi de statut                    |
| `/ressources/reserver?salle=`  | enseignant, admin | Formulaire de demande avec détection de conflit        |
| `/ressources/validations`      | admin             | File de validation (confirmer / refuser)               |

## Routes de l'API

| Route                                  | Qui                               | Corps → Réponse                                                         | Erreurs                                                                                  |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /rooms?q=&building=&minCapacity=` | enseignant, admin                 | `RoomView[]` (avec heures occupées aujourd'hui)                         | 403 étudiant                                                                             |
| `GET /rooms/{id}/availability?date=`   | enseignant, admin                 | `{roomId, date, slots[{start,end,status}]}` (sans données personnelles) | 404                                                                                      |
| `GET /reservations?scope=mine\|all`    | enseignant, admin (`all` : admin) | `Reservation[]`                                                         | 403                                                                                      |
| `POST /reservations`                   | enseignant, admin                 | `{roomId,date,start,end,attendees,purpose}` → `Reservation`             | 409 `ROOM_CONFLICT` (liste `conflicts`) · 422 passé, hors 08:00–19:00, capacité dépassée |
| `PUT /reservations/{id}/status`        | admin                             | `{status: confirmed\|refused}`                                          | 403 · 404 · 409 conflit ou déjà traitée                                                  |

## Événements de domaine publiés

`RéservationCréée` (demande d'un enseignant) · `RéservationConfirmée` (confirmation par l'admin, ou réservation créée par l'admin).

## Règles métier

- Seules les réservations **confirmées** bloquent un créneau ; plusieurs demandes en attente peuvent se chevaucher.
- À la confirmation, le service **revérifie** le conflit (une autre demande a pu être confirmée entre-temps) : 409.
- Une réservation d'un enseignant est « en attente » ; celle d'un administrateur est confirmée tout de suite.
- Ouverture : 08:00–19:00, créneaux de 30 minutes ; pas de réservation dans le passé ; participants ≤ capacité de la salle.

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] Contrôle du rôle (403 pour un étudiant)
- [ ] Détection de chevauchement atomique (éviter deux confirmations simultanées)
- [ ] Événements `RéservationCréée`, `RéservationConfirmée` publiés
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
