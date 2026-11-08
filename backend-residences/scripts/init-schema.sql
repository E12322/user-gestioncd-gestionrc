-- SmartCampus - Residences : un schema PostgreSQL par microservice.
-- Utilise par docker-compose (montage docker-entrypoint-initdb.d).
-- En local, chaque application cree aussi son schema au demarrage
-- (apps/*/src/config/ensure-schema.ts).
CREATE SCHEMA IF NOT EXISTS "BDD_Chambres";
CREATE SCHEMA IF NOT EXISTS "BDD_Demandes";
CREATE SCHEMA IF NOT EXISTS "BDD_Contrats";
