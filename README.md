# SmartCampus - Plateforme integree de gestion du campus

Projet academique d'architecture microservices - ESPRIT 5SE3 (2026).

---

## 1. Vue d'ensemble de l'architecture

SmartCampus centralise l'ensemble des activites administratives, pedagogiques et associatives du campus universitaire au sein d'une architecture distribuée composed de plusieurs microservices autonomes :

| Module | Responsabilite | Technologie | Port | Persistance & Communication |
|---|---|---|---|---|
| **Module 1 : Utilisateurs & Auth** | Authentification JWT, comptes, roles, securite | Node.js / Express | 4001 | MongoDB, JWT RS256/HS256, SMTP |
| **Module 2 : Academique** | Cours, notes, absences, groupes, plannings | Spring Boot / JPA | 8081 | Base H2 / PostgreSQL |
| **Module 3 : Ressources Campus** | Salles, reservations, equipements, incidents | Spring Boot / JPA | 8080 | Base MySQL |
| **Module 4 : Residences** | Chambres, demandes d'hebergement, contrats | NestJS (3 microservices + Gateway) | 3001 | PostgreSQL, RabbitMQ |
| **Module 5 : Vie Etudiante** | Clubs, adhesions, evenements, inscriptions | Spring Boot / JPA | 4005 | MongoDB / H2 |
| **Module 6 : Bibliotheque** | Catalogue, prets, regles de quotas, retards, reservations | Python / FastAPI / SQLAlchemy | 8082 | SQLite / PostgreSQL, Eureka, RabbitMQ |
| **Frontend** | Interface web unifiee responsive multi-roles | React / Vite / TypeScript | 5173 | Client HTTP unique, JWT, Tailwind |

---

## 2. Structure du repository

```text
Microservices/
├── SMART-COMPUS-BACK-END-ESPRIT-5SE3/     # Module 1 : Utilisateurs & Auth (Node.js Express :4001)
├── gestionetudiant/                        # Module 2 : Gestion Academique (Spring Boot :8081)
├── SMART-COMPUS-BACKEND/                   # Module 3 : Ressources Campus (Spring Boot :8080)
├── backend-residences/                     # Module 4 : Residences (NestJS Gateway :3001 & Services)
├── vie-etudiante/                          # Module 5 : Vie Etudiante (Spring Boot :4005)
├── gestion-bibliotheque/                   # Module 6 : Gestion Bibliotheque (Python FastAPI :8082)
├── SMART-COMPUS-ESPRIT-5SE3-FRONT-END/     # Frontend React (Vite :5173)
└── docs/                                   # Documentation et schemas d'architecture
```

---

## 3. Communication inter-services & flux metier

1. **Authentification & Identite unifiee :**
   - Le microservice Utilisateurs delivre les jetons JWT contenant les revendications (`sub`, `role`, `name`).
   - Chaque microservice valide le jeton et adapte les autorisations selon le role (`student`, `teacher`, `admin`).
2. **Routage :**
   - Le frontend dispose d'un routeur centralise capable de dialoguer directement avec chaque microservice ou a travers la passerelle API.
3. **Evenements asynchrones :**
   - Publication d'evenements metier (`LivreEmprunte`, `LivreRetourne`, `ChambreAttribuee`, `AdhesionValidee`) facilitant la synchronisation sans couplage fort.
4. **Decouverte de services :**
   - Enregistrement configurable aupres du registre Eureka (`http://localhost:8761/eureka`).

---

## 4. Guide de demarrage

### Prerequis
- **Node.js** 18+ et npm
- **Python** 3.10+
- **Java** 17+ et Maven
- **MongoDB**, **MySQL** ou **PostgreSQL** selon les modules lances

### Demarrage des microservices

#### Module 1 : Utilisateurs (Node.js)
```bash
cd SMART-COMPUS-BACK-END-ESPRIT-5SE3
npm install
npm run dev
```

#### Module 2 : Academique (Spring Boot)
```bash
cd gestionetudiant
./mvnw spring-boot:run
```

#### Module 3 : Ressources Campus (Spring Boot)
```bash
cd SMART-COMPUS-BACKEND
./mvnw spring-boot:run
```

#### Module 4 : Residences (NestJS)
```bash
cd backend-residences
npm install
npm run start:dev
```

#### Module 5 : Vie Etudiante (Spring Boot)
```bash
cd vie-etudiante
./mvnw spring-boot:run
```

#### Module 6 : Bibliotheque (Python FastAPI)
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
Documentation Swagger du microservice bibliotheque accessible sur : `http://localhost:8082/docs`.

#### Frontend (React / Vite)
```bash
cd SMART-COMPUS-ESPRIT-5SE3-FRONT-END
npm install
npm run dev
```
Interface accessible sur : `http://localhost:5173`.

---

## 5. Tests et validation qualite

- **Bibliotheque :**
  ```bash
  cd gestion-bibliotheque
  pytest
  ```
- **Residences :**
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
