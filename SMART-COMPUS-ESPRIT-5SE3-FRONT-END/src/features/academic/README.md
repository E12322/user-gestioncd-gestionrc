# Module 2 — Académique

**Microservice back-end : `academic-service`** · Rôles : étudiant, enseignant, administrateur.

## Dossiers

```
academic/
├─ index.ts        ModuleDef (route /academique)
├─ api/            fonctions d'API de l'academic-service (+ mock de chaque route)
├─ mocks/          cours, séances, inscriptions, notes, base en mémoire
├─ hooks/          useViewer, useCourses, useCourse, useEnrollments, useTimetable, useMyGrades, useCourseGrades
├─ types/          Course, Session, Enrollment, Grade, TimetableEntry…
├─ schemas/        validation d'une note (0 à 20)
├─ i18n/           textes français
├─ components/     CourseCard, TimetableGrid, useEnroll
└─ pages/          AcademicModule (onglets), CoursesPage, CourseDetailPage, TimetablePage, GradesPage, EnrollmentsPage
```

## Pages (front)

| Route                         | Accès           | Écran                                                            |
| ----------------------------- | --------------- | ---------------------------------------------------------------- |
| `/academique`                 | tous            | Catalogue des cours, recherche, filtre par département           |
| `/academique/cours/:id`       | tous            | Syllabus, enseignant, séances                                    |
| `/academique/emploi-du-temps` | tous            | Étudiant : cours validés · enseignant : ses cours · admin : tous |
| `/academique/notes`           | tous            | Étudiant : mes notes · enseignant : saisie et publication        |
| `/academique/inscriptions`    | étudiant, admin | Suivi des demandes · validation (admin)                          |

## Routes de l'API

| Route                                    | Qui                                    | Corps → Réponse                                                            | Erreurs                                                                          |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /courses?q=&department=&teacherId=` | tous                                   | `CourseView[]` (avec `myEnrollment`)                                       | —                                                                                |
| `GET /courses/{id}`                      | tous                                   | `CourseView`                                                               | 404                                                                              |
| `POST /enrollments`                      | étudiant                               | `{courseId}` → `Enrollment` (en attente)                                   | 409 `ALREADY_ENROLLED` · `COURSE_FULL` · `SCHEDULE_CONFLICT` (liste `conflicts`) |
| `GET /enrollments`                       | étudiant (les siennes), admin (toutes) | `Enrollment[]`                                                             | 403 enseignant                                                                   |
| `PUT /enrollments/{id}/status`           | admin                                  | `{status: validated\|refused}`                                             | 403 · 404 · 409 `ALREADY_DECIDED` / `COURSE_FULL`                                |
| `GET /timetable`                         | tous                                   | `TimetableEntry[]` selon le rôle                                           | —                                                                                |
| `GET /grades/me`                         | étudiant                               | `{items, average, creditsEarned, creditsTotal}` (notes publiées seulement) | —                                                                                |
| `GET /courses/{id}/grades`               | enseignant du cours, admin             | `{course, entries[]}`                                                      | 403 · 404                                                                        |
| `PUT /courses/{id}/grades`               | enseignant du cours, admin             | `{values: {studentId: note\|null}, publish}`                               | 403 · 422 note hors 0–20                                                         |

## Événements de domaine publiés

`InscriptionValidée` · `NotePubliée`.

## Règles métier

- Conflit d'horaire avec un autre cours suivi, cours complet ou doublon : **409** (le front affiche la liste `conflicts`).
- Un cours n'est comptabilisé dans les places qu'une fois l'inscription **validée** par l'admin.
- La moyenne est pondérée par les crédits, sur les notes **publiées** uniquement ; seuil de réussite : 10.
- Une note peut être saisie sans être publiée ; seule la publication la rend visible à l'étudiant.

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] Contrôle du rôle et de l'enseignant propriétaire du cours (403)
- [ ] Événements `InscriptionValidée`, `NotePubliée` publiés
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
