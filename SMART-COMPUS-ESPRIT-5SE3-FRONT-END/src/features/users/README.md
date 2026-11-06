# Module 1 — Utilisateurs

**Microservice back-end : `user-service`** · Rôles : administrateur (gestion), tous (profil, mot de passe, photo).

## Dossiers

```
users/
├─ index.ts          ModuleDef (route /utilisateurs, rôle admin)
├─ routes.ts         pages exposées hors du module (connexion, inscription, profil…) branchées dans app/router
├─ api/              fonctions d'API du user-service (+ mock de chaque route)
├─ mocks/            comptes fictifs, mots de passe, historique, base en mémoire
├─ hooks/            useUsers, useUser, useLoginHistory, usePermissions
├─ types/            UserAccount, LoginResult, AdminCreateInput…
├─ utils/            validation.ts : domaine d'e-mail, mot de passe, mot de passe temporaire
├─ i18n/             textes français
├─ components/       AccountForm, AccountCreatedDialog, AvatarUploader, ChangePasswordForm…
├─ pages/            UsersModule (onglets), UsersListPage, RolesMatrixPage, LoginHistoryPage, ProfilePage
└─ auth/             sous-ensemble « connexion » (pages publiques, AuthContext, schémas, api.mock.ts)
```

## Pages (front)

| Route                                                                                                      | Accès    | Écran                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| `/utilisateurs`                                                                                            | admin    | Comptes · Rôles et permissions · Historique de connexion       |
| `/profil`                                                                                                  | tous     | Profil, photo, mot de passe, mes connexions                    |
| `/connexion`, `/inscription`, `/verification-email`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` | public   | Authentification                                               |
| `/changer-mot-de-passe`                                                                                    | connecté | Obligatoire à la 1re connexion avec un mot de passe temporaire |

## Routes de l'API

| Route                                                  | Qui               | Corps → Réponse                                                                                                                                        | Erreurs                                                      |
| ------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `POST /auth/login`                                     | public            | `{email, password}` → `{token, user{id,name,email,role,avatarUrl?,mustChangePassword?}}`                                                               | 401 · 403 compte désactivé · 423 compte verrouillé           |
| `POST /auth/register`                                  | public            | `{firstName,lastName,email,password}` → `UserAccount` (**toujours rôle student**)                                                                      | 409 e-mail existant · 422 domaine                            |
| `POST /auth/verify-email` · `/auth/resend-activation`  | public            | `{email, code}` / `{email}`                                                                                                                            | 400 code invalide                                            |
| `POST /auth/forgot-password` · `/auth/reset-password`  | public            | `{email}` / `{email, token, password}`                                                                                                                 | 400 lien invalide                                            |
| `POST /users`                                          | admin             | `{firstName,lastName,email,role}` → `{account}` ; le service **génère un mot de passe temporaire et l'envoie par e-mail**, `mustChangePassword = true` | 403 · 409 · 422                                              |
| `GET /users?q=&role=&status=`                          | admin             | → `{items, stats}`                                                                                                                                     | 403                                                          |
| `GET /users/{id}` · `PUT /users/{id}`                  | soi-même ou admin | profil `{firstName,lastName,phone?}`                                                                                                                   | 403 · 404                                                    |
| `PUT /users/{id}/password`                             | soi-même          | `{current, next}`                                                                                                                                      | 401 `WRONG_PASSWORD` · 422 `SAME_PASSWORD` / `WEAK_PASSWORD` |
| `PUT /users/{id}/avatar`                               | soi-même          | `{avatarUrl \| null}` (JPEG 256 px, en production : envoi de fichier)                                                                                  | 404                                                          |
| `PUT /users/{id}/role`                                 | admin             | `{role}`                                                                                                                                               | 403 · 404                                                    |
| `PATCH /users/{id}/status` · `DELETE /users/{id}`      | admin             | `{status: active\|inactive}`                                                                                                                           | 403 · 404                                                    |
| `GET /roles/permissions` · `PUT /roles/permissions`    | admin             | matrice rôle × permission                                                                                                                              | 403                                                          |
| `GET /users/{id}/login-history` · `GET /login-history` | soi-même / admin  | `LoginEvent[]`                                                                                                                                         | 403                                                          |

## Événements de domaine publiés

`UtilisateurCréé` (création d'un compte, par l'admin ou par inscription) · `RôleModifié`.

## Règles métier

- Une adresse e-mail = un compte ; l'e-mail doit être au domaine institutionnel (`VITE_EMAIL_DOMAIN`).
- Auto-inscription : **étudiant uniquement**. Les comptes enseignants et administrateurs sont créés par un administrateur.
- Le **premier administrateur** est créé par le back-end au démarrage (script ou migration) ; aucun écran ne le crée.
- Mot de passe temporaire : le nouveau mot de passe doit être différent du temporaire et respecter les règles (8 caractères, majuscule, minuscule, chiffre).
- 5 échecs de connexion consécutifs suspendent le compte (423).
- Le rôle vient toujours du compte, jamais du formulaire ; il est placé dans le JWT. Chaque service doit le relire (403 si interdit).

## Démo

Mot de passe des comptes fictifs : `Campus2026!`. Code de vérification d'e-mail : `123456`. Comptes créés en démo : en mémoire, perdus au rechargement.

## À cocher côté back-end

- [ ] Routes ci-dessus avec les mêmes noms de champs
- [ ] JWT contenant `sub`, `name`, `role`
- [ ] Envoi de l'e-mail du mot de passe temporaire (en développement : Mailpit)
- [ ] Événements `UtilisateurCréé`, `RôleModifié` publiés
- [ ] Premier administrateur créé au démarrage
- [ ] Front branché : `VITE_USE_MOCKS=false` et `VITE_API_BASE_URL`
