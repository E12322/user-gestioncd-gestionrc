# Microservice Gestion de la Bibliothèque (`library-service`)

Microservice backend en **Python / FastAPI / SQLAlchemy** pour la plateforme **SmartCampus** (ESPRIT 5SE3).

## Architecture Microservices & Écosystème

| Composant | Rôle & Intégration |
|---|---|
| **Framework** | **FastAPI** (Python 3.11) + Uvicorn (ASGI haute performance) |
| **Persistance** | **SQLAlchemy ORM** + SQLite (zéro config) / PostgreSQL / MySQL |
| **Service Discovery** | **Netflix Eureka Client** (`py-eureka-client`) pour découverte dynamique via Spring Cloud Eureka Server (`http://localhost:8761/eureka`) |
| **API Gateway** | Compatible routage direct via API Gateway (Spring Cloud Gateway / NestJS Gateway / Kong) ou reverse-proxy Vite |
| **Message Broker** | **RabbitMQ** (AMQP via `pika`) avec topic exchange `smartcampus.events` pour les événements métier |
| **Sécurité** | Validation JWT (`python-jose`), contrôle d'accès RBAC (`student`, `teacher`, `admin`), support headers Gateway (`X-User-Id`, `X-User-Role`) |
| **Notifications** | Intégration SMTP (Mailpit / Mailhog) pour alertes de retard |

---

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
- **Événements de domaine publiés :**
  - `LivreEmprunté`
  - `LivreRetourné`

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
| `EUREKA_SERVER` | `http://localhost:8761/eureka` | URL du serveur Eureka |
| `EUREKA_ENABLED` | `false` | Activer l'enregistrement automatique Eureka |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | URL de connexion RabbitMQ |
| `RABBITMQ_ENABLED` | `false` | Activer la publication RabbitMQ |
| `SMTP_HOST` | `localhost` | Serveur SMTP |
| `SMTP_PORT` | `1025` | Port SMTP (Mailpit / Mailhog) |
