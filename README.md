# SmartCampus - Plateforme intégrée de gestion du campus

Projet académique d'architecture microservices - ESPRIT 5SE3 (2026).

---

## 1. Vue d'ensemble de l'architecture

SmartCampus centralise l'ensemble des activités administratives, pédagogiques et associatives du campus universitaire au sein d'une architecture distribuée composée de plusieurs microservices autonomes :

| Module | Responsabilité | Technologie | Port | Persistance & Communication |
|---|---|---|---|---|
| **Module 1 : Utilisateurs & Auth** | Authentification JWT, comptes, rôles, sécurité | Node.js / Express | 4001 | MongoDB, JWT RS256/HS256, SMTP |
| **Module 2 : Académique** | Cours, notes, absences, groupes, plannings | Spring Boot / JPA | 8081 | Base H2 / PostgreSQL |
| **Module 3 : Ressources Campus** | Salles, réservations, équipements, incidents | Spring Boot / JPA | 8080 | Base MySQL |
| **Module 4 : Résidences** | Chambres, demandes d'hébergement, contrats | NestJS (3 microservices + Gateway) | 3001 | PostgreSQL, RabbitMQ |
| **Module 5 : Vie Étudiante** | Clubs, adhésions, événements, inscriptions | Spring Boot / JPA | 4005 | MongoDB / H2 |
| **Module 6 : Bibliothèque** | Catalogue, prêts, règles de quotas, retards, réservations | Python / FastAPI / SQLAlchemy | 8082 | SQLite / PostgreSQL, Eureka, RabbitMQ |
| **Agent IA** | Assistant de discussion (règlement, frais, calendrier, compte), outils lecture/écriture avec confirmation | Python / FastAPI / Pydantic AI (Gemini) | 4010 | JWT de l'utilisateur (RS256 JWKS / HS256 dev), RAG BM25, MongoDB optionnel |
| **Frontend** | Interface web unifiée responsive multi-rôles | React / Vite / TypeScript | 5173 | Client HTTP unique, JWT, Tailwind |

---

## 2. Structure du repository

```text
Microservices/
├── SMART-COMPUS-BACK-END-ESPRIT-5SE3/     # Module 1 : Utilisateurs & Auth (Node.js Express :4001)
├── gestionetudiant/                        # Module 2 : Gestion Académique (Spring Boot :8081)
├── SMART-COMPUS-BACKEND/                   # Module 3 : Ressources Campus (Spring Boot :8080)
├── backend-residences/                     # Module 4 : Résidences (NestJS Gateway :3001 & Services)
├── vie-etudiante/                          # Module 5 : Vie Étudiante (Spring Boot :4005)
├── gestion-bibliotheque/                   # Module 6 : Gestion Bibliothèque (Python FastAPI :8082)
├── agent-service/                          # Agent IA : assistant SmartCampus (FastAPI :4010)
├── SMART-COMPUS-ESPRIT-5SE3-FRONT-END/     # Frontend React (Vite :5173)
└── docs/                                   # Documentation et schémas d'architecture
```

---

## 3. Communication inter-services & flux métier

1. **Authentification & Identité unifiée :**
   - Le microservice Utilisateurs délivre les jetons JWT contenant les revendications (`sub`, `role`, `name`).
   - Chaque microservice valide le jeton et adapte les autorisations selon le rôle (`student`, `teacher`, `admin`).
2. **Routage :**
   - Le frontend dispose d'un routeur centralisé capable de dialoguer directement avec chaque microservice ou à travers la passerelle API.
3. **Événements asynchrones :**
   - Publication d'événements métier (`LivreEmprunté`, `LivreRetourné`, `ChambreAttribuée`, `AdhésionValidée`) facilitant la synchronisation sans couplage fort.
4. **Découverte de services :**
   - Enregistrement configurable auprès du registre Eureka (`http://localhost:8761/eureka`).

---

## 4. Guide de démarrage

### Prérequis
- **Node.js** 18+ et npm
- **Python** 3.10+
- **Java** 17+ et Maven
- **MongoDB**, **MySQL** ou **PostgreSQL** selon les modules lancés

### Démarrage des microservices

#### Module 1 : Utilisateurs (Node.js)
```bash
cd SMART-COMPUS-BACK-END-ESPRIT-5SE3
npm install
npm run dev
```

#### Module 2 : Académique (Spring Boot)
```bash
cd gestionetudiant
./mvnw spring-boot:run
```

#### Module 3 : Ressources Campus (Spring Boot)
```bash
cd SMART-COMPUS-BACKEND
./mvnw spring-boot:run
```

#### Module 4 : Résidences (NestJS)
```bash
cd backend-residences
npm install
npm run start:dev
```

#### Module 5 : Vie Étudiante (Spring Boot)
```bash
cd vie-etudiante
./mvnw spring-boot:run
```

#### Module 6 : Bibliothèque (Python FastAPI)
```bash
cd gestion-bibliotheque
# Sous Windows :
.\demarrer-backend.cmd

# Ou manuellement :
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8082 --reload
```
Documentation Swagger du microservice bibliothèque accessible sur : `http://localhost:8082/docs`.

#### Agent IA (Python, voir `agent-service/README.md`)
```bash
cd agent-service
python -m venv .venv && .venv\Scripts\python -m pip install -e ".[dev]"   # première fois
copy .env.example .env     # GOOGLE_API_KEY + JWT_SECRET identique à celui du module 1
.venv\Scripts\python -m uvicorn app.main:app --port 4010
```
Le widget de l'assistant (bouton rond en bas à droite) apparaît dans le front dès que l'utilisateur est connecté. Il réutilise le cookie `httpOnly` du module 1 ; `VITE_AGENT_URL` (défaut `http://localhost:4010`) indique où le joindre. L'agent n'a aucun droit propre : chaque appel vers le module 1 porte le JWT de l'utilisateur.

#### Frontend (React / Vite)
```bash
cd SMART-COMPUS-ESPRIT-5SE3-FRONT-END
npm install
npm run dev
```
Interface accessible sur : `http://localhost:5173`.

---

## 5. Tests et validation qualité

- **Bibliothèque :**
  ```bash
  cd gestion-bibliotheque
  pytest
  ```
- **Résidences :**
  ```bash
  cd backend-residences
  npm test
  ```
- **Frontend :**
  ```bash
  cd SMART-COMPUS-ESPRIT-5SE3-FRONT-END
  npm run build
  ```

---
ESPRIT 5SE3 - Projet Microservices
