# Microservice Gestion de la Bibliothèque (`library-service`)

Microservice backend en **Python / FastAPI / SQLAlchemy** pour la plateforme **SmartCampus** (ESPRIT 5SE3).

## Fonctionnalités Métier

- **Catalogue & Recherche :** Consultation du catalogue, filtres de recherche (titre, auteur, ISBN, catégorie), calcul dynamique des exemplaires disponibles et en attente.
- **Gestion des Emprunts :**
  - Règles différenciées : 14 jours / 3 prêts max pour les étudiants, 30 jours / 5 prêts max pour les enseignants et administrateurs.
  - Détection automatique et blocage en cas de prêt en retard (`HAS_OVERDUE`).
  - Prolongation jusqu'à 2 fois (`MAX_RENEWALS`), bloquée si l'ouvrage est réservé ou en retard.
- **File d'attente & Réservations :**
  - Réservation possible dès épuisement des exemplaires disponibles (`available == 0`).
  - Notification et passage automatique de la 1ère réservation en statut `ready` lors du retour d'un exemplaire.
  - Consommation prioritaire de la réservation lors de l'emprunt.
- **Sécurité & Authentification :**
  - Vérification des jetons JWT émis par le module Utilisateurs (`user-service`).
  - Contrôle des accès par rôles (routes réservées aux administrateurs pour la gestion des prêts, retours et ajouts au catalogue).
- **Événements de domaine & Notifications :**
  - Publication des événements métier `LivreEmprunté` et `LivreRetourné`.
  - Intégration SMTP pour alertes de retards.

---

## Démarrage rapide

### 1. Prérequis
- Python 3.10+
- Pip

### 2. Installation & Lancement en local

```bash
cd gestion-bibliotheque

# Création du venv et installation
python -m venv venv
.\venv\Scripts\Activate.ps1    # Sous Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Lancement
uvicorn app.main:app --port 8082 --reload
```

Ou sous Windows en un clic via `demarrer-backend.cmd`.

### 3. Documentation interactive Swagger / OpenAPI

Une fois démarré, accédez à la documentation Swagger interactive sur :
- **Swagger UI :** `http://localhost:8082/docs`
- **ReDoc :** `http://localhost:8082/redoc`

### 4. Tests unitaires et d'intégration

```bash
pytest
```

---

## Configuration (`.env`)

| Variable | Valeur par défaut | Description |
|---|---|---|
| `PORT` | `8082` | Port d'écoute du microservice |
| `DATABASE_URL` | `sqlite:///./library.db` | URL de la base de données |
| `JWT_SECRET` | `change-me-en-production-32-caracteres-minimum` | Secret partagé JWT |
| `USER_SERVICE_URL` | `http://localhost:4001` | URL du microservice User |
| `SMTP_HOST` | `localhost` | Serveur SMTP |
| `SMTP_PORT` | `1025` | Port SMTP (Mailpit / Mailhog) |
