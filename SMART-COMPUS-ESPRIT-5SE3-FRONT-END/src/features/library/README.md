# Module 6 — Bibliothèque

**Microservice back-end : `library-service`** · Rôles : étudiant, enseignant, administrateur (gestion).

## Dossiers

```
library/
├─ index.ts        ModuleDef (route /bibliotheque)
├─ api/            fonctions d'API du library-service (+ mock de chaque route)
├─ mocks/          ouvrages, prêts, réservations, règles de prêt, base en mémoire
├─ hooks/          useViewer, useBooks, useBook, useMyLibrary, useLoans
├─ types/          Book, BookView, Loan, BookReservation, MyLibrary…
├─ schemas/        validation du formulaire d'ajout d'un ouvrage
├─ utils/          time.ts : dates, écart en jours, prolongation
├─ i18n/           textes français
├─ components/     BookCard, BookActions, AvailabilityBadge, LoanRow, BookForm, useBookActions, Field
└─ pages/          LibraryModule (onglets), CatalogPage, BookDetailPage, MyLoansPage, LoansAdminPage
```

## Pages (front)

| Route                      | Accès | Écran                                                           |
| -------------------------- | ----- | --------------------------------------------------------------- |
| `/bibliotheque`            | tous  | Catalogue : recherche, catégorie, disponibles uniquement        |
| `/bibliotheque/livres/:id` | tous  | Fiche : résumé, exemplaires, emprunter ou réserver              |
| `/bibliotheque/mes-prets`  | tous  | Prêts en cours, retards, prolongation, réservations, historique |
| `/bibliotheque/gestion`    | admin | Tous les prêts, enregistrer un retour, ajouter un ouvrage       |

## Routes de l'API

| Route                                    | Qui          | Corps → Réponse                                                         | Erreurs                                                                    |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /books?q=&category=&availableOnly=` | tous         | `BookView[]` (avec `available`, `waiting`, `myLoanId`, `myReservation`) | —                                                                          |
| `GET /books/{id}`                        | tous         | `BookView`                                                              | 404                                                                        |
| `POST /books`                            | admin        | `{title,author,isbn,category,year,copies,description}`                  | 403 · 409 `ISBN_EXISTS`                                                    |
| `POST /loans`                            | tous         | `{bookId}` → `Loan`                                                     | 409 `ALREADY_BORROWED` · `HAS_OVERDUE` · `LOAN_LIMIT` · `BOOK_UNAVAILABLE` |
| `GET /loans/me`                          | tous         | `{loans, reservations, limit}`                                          | —                                                                          |
| `PUT /loans/{id}/renew`                  | emprunteur   | — → `Loan`                                                              | 403 · 409 `OVERDUE` / `RENEWAL_LIMIT` / `BOOK_RESERVED`                    |
| `GET /loans`                             | admin        | `Loan[]` (retards d'abord)                                              | 403                                                                        |
| `PUT /loans/{id}/return`                 | admin        | — → `Loan`                                                              | 403 · 404 · 409 `ALREADY_RETURNED`                                         |
| `POST /books/{id}/reservations`          | tous         | — → `BookReservation` (rang dans la file)                               | 409 `ALREADY_BORROWED` / `ALREADY_RESERVED` / `BOOK_AVAILABLE`             |
| `DELETE /reservations/{id}`              | propriétaire | annule la réservation                                                   | 403 · 404                                                                  |

## Événements de domaine publiés

`LivreEmprunté` · `LivreRetourné`.

## Règles métier

- Durée de prêt : 14 jours (étudiant), 30 jours (enseignant, administrateur). Plafond : 3 prêts simultanés (étudiant), 5 sinon.
- Un prêt **en retard** bloque tout nouvel emprunt et ne peut pas être prolongé.
- Prolongation : 2 fois au plus, impossible si l'ouvrage a des réservations en attente.
- Un ouvrage sans exemplaire disponible se réserve (file d'attente). Au retour d'un exemplaire, la première réservation passe à « prête à retirer » et l'exemplaire lui est gardé ; l'emprunt consomme la réservation.
- Le statut d'un prêt (`active`, `overdue`, `returned`) et les jours de retard sont calculés par le service.

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] Calcul de disponibilité = exemplaires − prêts en cours − réservations « prêtes »
- [ ] Événements `LivreEmprunté`, `LivreRetourné` publiés
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
