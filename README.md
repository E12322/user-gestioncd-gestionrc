# 🎓 SmartCampus — Plateforme de gestion du campus

Projet académique — ESPRIT 5SE3 (2026)

## Architecture Microservices

| Module | Technologie | Port | Description |
|--------|------------|------|-------------|
| **Module 1** — Utilisateurs & Auth | Node.js / Express / MongoDB | 4001 | Gestion des comptes, rôles, authentification JWT, SMTP |
| **Module 2** — Gestion Académique | Spring Boot / JPA / H2 | 8081 | Cours, inscriptions, notes, emploi du temps, groupes |
| **Module 3** — Ressources Campus | Spring Boot / JPA / MySQL | 8080 | Salles, réservations, équipements, interventions |
| **Module 4** — Résidences | NestJS / TypeORM / PostgreSQL / RabbitMQ | 3001 | Microservices Chambre (3011), Demande (3012), Contrat (3013) + passerelle API (3001, JWT) |
| **Frontend** | React / Vite / TypeScript | 5173 | Interface utilisateur unifiée multi-rôles |

## Structure du projet

```
├── SMART-COMPUS-BACK-END-ESPRIT-5SE3/     # Module 1 : User Service (Node.js)
├── gestionetudiant/                        # Module 2 : Gestion Académique (Spring Boot)
├── SMART-COMPUS-BACKEND/                   # Module 3 : Gestion Ressources (Spring Boot)
├── backend-residences/                     # Module 4 : Résidences — 4 microservices NestJS + RabbitMQ (dossier unique, npm workspaces)
├── docs/                                   # Documentation technique du module Résidences
├── SMART-COMPUS-ESPRIT-5SE3-FRONT-END/     # Frontend React
├── convert_pptx.ps1                        # Utilitaire conversion PPTX
└── parse_pptx.mjs                          # Utilitaire parsing PPTX
```

## Démarrage rapide

### Prérequis
- **Node.js** 18+ et npm
- **Java** 17+ et Maven
- **MongoDB** (service Windows)
- **MySQL** via XAMPP (port 3307)
- **PostgreSQL** 16 (service Windows ou Docker) — Module 4 Résidences (base `smartcampus`, un schéma par service : `BDD_Chambres`, `BDD_Demandes`, `BDD_Contrats`)
- **RabbitMQ** (service Windows ou Docker, UI : http://localhost:15672) — Module 4 Résidences (file durable `residences.contrats.events`)

### Lancement

```bash
# 1. Module 1 — User Service
cd SMART-COMPUS-BACK-END-ESPRIT-5SE3
npm install && npm run dev

# 2. Module 2 — Gestion Académique
cd gestionetudiant
./mvnw spring-boot:run

# 3. Module 3 — Gestion Ressources
cd SMART-COMPUS-BACKEND
./mvnw spring-boot:run

# 4. Module 4 — Résidences (4 microservices NestJS + passerelle + RabbitMQ)
cd backend-residences
npm install && npm run seed && npm run start:dev   # passerelle :3001 · chambres :3011 · demandes :3012 · contrats :3013
# Le seed passe par l'API de la passerelle (données de démo + preuve d'intégration).
# Microservices séparés, file durable RabbitMQ, JWT vérifié à la passerelle.

# 5. Frontend
cd SMART-COMPUS-ESPRIT-5SE3-FRONT-END
npm install && npm run dev
```

## Équipe

- **Eya Touahri** — Module 3 (Gestion des Ressources Campus)
- **Ahlem Guesmi** — Module 2 (Gestion Académique / Étudiant)

---
© 2026 SmartCampus — ESPRIT 5SE3
