# Déploiement gratuit, sans carte bancaire : étape 1

Étape 1 : **front (Vercel)**, **user-service + agent IA (Render)**, **base MongoDB (Atlas)**. Les autres modules (académique,
ressources, résidences, bibliothèque, vie étudiante) ne sont pas encore en ligne : en production, le front affiche pour eux des
données fictives (voir `VITE_REAL_API_PREFIXES` ci-dessous). Ils feront l'objet de l'étape 2.

```
Navigateur ──► Vercel (front + relais /svc/*) ──► Render : smartcampus-user   ──► MongoDB Atlas
                                              └─► Render : smartcampus-agent  ──► Gemini
```

Le navigateur ne parle qu'à **une seule origine** (le domaine Vercel). Vercel relaie `/svc/user/*` et `/svc/agent/*` vers Render :
les cookies de session (`httpOnly`, `SameSite=Strict`) restent donc valides, sans domaine personnalisé.

## 0. Ce qu'il faut avoir

Comptes **gratuits** : GitHub (le fork), [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register), [Render](https://render.com),
[Vercel](https://vercel.com) (se connecter avec GitHub). Un compte Google avec la validation en 2 étapes (pour le mot de passe
d'application Gmail). Vérifier à l'inscription que chaque offre ne demande pas de carte.

## 1. MongoDB Atlas

1. Créer un cluster **M0 (gratuit)**.
2. *Database Access* : créer un utilisateur (nom + mot de passe long).
3. *Network Access* : autoriser `0.0.0.0/0` (les adresses IP de Render gratuit changent).
4. *Connect > Drivers* : copier la chaîne, ajouter le nom de la base : `mongodb+srv://USER:MOT_DE_PASSE@cluster0.xxxxx.mongodb.net/smartcampus_users`.

## 2. Secrets à préparer (jamais dans git)

| Secret | Comment l'obtenir |
|---|---|
| `GOOGLE_API_KEY` | **Nouvelle** clé sur <https://aistudio.google.com/apikey> (révoquer l'ancienne, elle a été exposée) |
| `SMTP_USER` / `SMTP_PASS` | votre adresse Gmail + un **mot de passe d'application** (compte Google > Sécurité > Mots de passe d'application) |
| `JWT_PRIVATE_KEY` | dans `SMART-COMPUS-BACK-END-ESPRIT-5SE3` : `npm run keys:generate`, puis en PowerShell : `[Convert]::ToBase64String([IO.File]::ReadAllBytes("keys\jwt-private.pem"))` |
| `FIRST_ADMIN_PASSWORD` | 12 caractères minimum, avec majuscule, minuscule et chiffre (le compte `admin@gmail.com` est créé au premier démarrage si la base n'a pas d'admin) |

## 3. Render (user-service et agent)

1. *New > Blueprint*, choisir **le fork** : Render lit `render.yaml` et crée `smartcampus-user` et `smartcampus-agent`.
2. Renseigner les variables marquées `sync: false` (voir `render.yaml`) :
   - `smartcampus-user` : `MONGODB_URI`, `JWT_PRIVATE_KEY`, `FIRST_ADMIN_PASSWORD`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`,
     et `CORS_ORIGINS` / `FRONTEND_URL` (l'adresse Vercel, voir étape 5 : mettre une valeur provisoire, la corriger ensuite).
   - `smartcampus-agent` : `GOOGLE_API_KEY`, `JWKS_URL` = `https://smartcampus-user.onrender.com/.well-known/jwks.json`,
     `USER_SERVICE_URL` = `https://smartcampus-user.onrender.com`, `CORS_ORIGINS`.
3. Noter les **adresses réelles** des deux services. Si Render a ajouté un suffixe au nom (nom déjà pris), les utiliser partout.
4. Vérifier : `https://smartcampus-user.onrender.com/health` et `https://smartcampus-agent.onrender.com/health` répondent 200
   (le premier appel peut prendre 30 à 60 s : le service gratuit s'endort après environ 15 minutes sans trafic).

## 4. Vercel (front)

1. *Add New > Project*, importer **le fork**.
2. **Root Directory** : `SMART-COMPUS-ESPRIT-5SE3-FRONT-END` (Vercel détecte Vite).
3. Variables d'environnement (Production) :

   | Variable | Valeur |
   |---|---|
   | `VITE_USE_MOCKS` | `false` |
   | `VITE_USER_API_BASE_URL` | `/svc/user` |
   | `VITE_AGENT_URL` | `/svc/agent` |
   | `VITE_EMAIL_DOMAIN` | `gmail.com` |
   | `VITE_REAL_API_PREFIXES` | `/auth,/users,/roles,/login-history` |

4. Si les adresses Render diffèrent de `smartcampus-user.onrender.com` / `smartcampus-agent.onrender.com`, corriger les
   `destination` dans `SMART-COMPUS-ESPRIT-5SE3-FRONT-END/vercel.json`, puis pousser.
5. Déployer et noter l'adresse du projet (`https://xxx.vercel.app`).

## 5. Boucler la configuration

Dans Render, mettre l'adresse Vercel exacte (sans `/` final) dans `CORS_ORIGINS` et `FRONTEND_URL` des deux services, puis
redéployer. Le user-service refuse toute requête d'une origine inconnue (protection CSRF) : une adresse fausse = erreurs 403.

## 6. Tester en ligne

1. Ouvrir l'adresse Vercel, puis **s'inscrire** avec une adresse Gmail : le code à 6 chiffres doit arriver par e-mail.
2. Se connecter avec `admin@gmail.com` et `FIRST_ADMIN_PASSWORD` (changement de mot de passe demandé à la première connexion).
3. Ouvrir le bouton rond de l'assistant : « Quel est mon profil ? ».

## Limites connues

- **E-mails.** Gmail passe par SMTP (ports 587/465). Si l'hébergeur gratuit bloque ces ports, le journal de `smartcampus-user`
  affiche `e-mail non envoyé` et aucun code n'arrive. Il faudra alors un envoi par API HTTPS (Gmail API, Resend ou Brevo).
- **Limitation de débit.** `TRUST_PROXY=2` (Vercel puis Render) : sans cela, tous les utilisateurs partageraient l'adresse IP de Vercel
  et seraient limités ensemble.
- **Voix Piper.** Désactivée (`TTS_PROVIDER=none`) : la voix du navigateur la remplace. Pour l'activer, reconstruire l'agent avec
  `--build-arg WITH_VOICE=true` et `TTS_PROVIDER=piper` (risque de dépasser les 512 Mo de RAM gratuits).
- **Quota Gemini gratuit** : environ 7 questions par minute pour tous les utilisateurs ensemble.
- **Services endormis** : prévoir un « réveil » (ouvrir les deux `/health`) avant une démonstration.
- **Autres modules** : données fictives tant que l'étape 2 n'est pas faite.
