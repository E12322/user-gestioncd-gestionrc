# SmartCampus - Module 3 : Gestion des Ressources du Campus

Ce projet est l'implémentation officielle avec **Java 17 / Spring Boot** du **Module 3 (Gestion des Ressources du Campus)** pour la plateforme **SmartCampus**, conformément aux spécifications fonctionnelles, non fonctionnelles et aux vues architecturales (Context, Building Block, Runtime, Deployment, FCM).

---

## 🏛️ 1. Architecture Logicielle & Respect des Spécifications

### A. Patron d'Architecture en 5 Couches (Building Block View - Slides 60, 67, 68)
Pour chaque agrégat métier, l'application suit la chaîne stricte :
1. **Couche Présentation / IHM** : DTOs de validation (`com.smartcampus.ressources.dto`)
2. **Couche Contrôleurs REST** : Points d'entrée HTTPS (`com.smartcampus.ressources.controleur`)
   - `SalleController` (`/api/salles`)
   - `ReservationController` (`/api/reservations`)
   - `EquipementController` (`/api/equipements`)
   - `InterventionController` (`/api/interventions`)
3. **Couche Services Métier** : Interfaces et implémentations (`com.smartcampus.ressources.service`)
   - `ISalleService` / `SalleServiceImpl`
   - `IReservationService` / `ReservationServiceImpl`
   - `IEquipementService` / `EquipementServiceImpl`
   - `IInterventionService` / `InterventionServiceImpl`
4. **Couche Domaine Métier (Entités JPA)** : (`com.smartcampus.ressources.entite`)
   - `Ressource` & `Salle`
   - `Reservation`
   - `Equipement`
   - `Intervention`
   - `AuditLog`
5. **Couche Accès aux données (Spring Data JPA Repositories)** : (`com.smartcampus.ressources.repository`)
   - `SalleRepository`, `ReservationRepository`, `EquipementRepository`, `InterventionRepository`, `AuditLogRepository`

---

## 🧩 2. Patrons de Conception Intégrés

### 1. Patron Façade (Structurel - Slides 62, 72)
- **`IReservation`** (`ReservationFacadeImpl`) : Point d'entrée unique masquant la complexité interne (salles, réservations, contrôles de calendrier) exposé aux modules externes (ex: Module Gestion de la Vie Étudiante pour réserver des salles pour les événements).
- **`IInventaire`** (`InventaireFacadeImpl`) : Point d'entrée pour la consultation des équipements, signalement de pannes et planification des interventions.

### 2. Patron Observateur (Comportemental - Slides 63, 72)
- **Sujet** : `RessourceEventPublisher`
- **Événements** : `RESERVATION_CREEE`, `RESERVATION_VALIDEE`, `RESERVATION_REFUSEE`, `RESERVATION_ANNULEE`, `PANNE_DECLAREE`, `INTERVENTION_PLANIFIEE`, `INTERVENTION_CLOTUREE`, `ALERTE_MAINTENANCE_PREVENTIVE`.
- **Observateurs attachés** :
  - `NotificationEmailObserver` : Simule l'envoi d'e-mails par SMTP (port 587) aux enseignants, responsables et techniciens.
  - `JournalAuditObserver` : Enregistre automatiquement toute opération sensible dans le journal d'audit (`AuditLogRepository`) garantissant l'exigence **BNF.8 (Traçabilité)**.

---

## 📋 3. Règles Métier Implémentées

| Règle | Description | Vérification dans le code |
|---|---|---|
| **RR1** | **Anti double-réservation** : Une salle ne peut pas être réservée 2 fois sur le même créneau. | `ReservationRepository.findConflictingReservations()` |
| **RR2** | **Capacité maximale** : Le nombre de participants ne doit pas dépasser la capacité de la salle. | `CapaciteDepasseeException` levée si `nbParticipants > salle.capacite` |
| **RR3** | **Contrôle d'accès** : Seul un enseignant ou responsable peut demander une réservation. | Contrôle via l'interface externe `IAuthentification` |
| **RR4** | **Validation** : Une réservation n'est confirmée qu'après validation du responsable. | Statut initial `DEMANDEE`, transition vers `VALIDEE` via `/valider` |
| **MM1** | **Indisponibilité panne** : Un équipement en panne ou maintenance est indisponible. | Statut `EN_PANNE` / `EN_MAINTENANCE` avec `isDisponible() == false` |
| **MM2** | **Traçabilité du signalement** : Tout signalement est rattaché à son auteur. | Stockage de l'`auteurSignalementId` et du nom |
| **MM3** | **Maintenance préventive** : Alertes et planification automatique selon périodicité. | Tâche `@Scheduled` `verifierEtGenererMaintenancesPreventives()` |

---

## 🚀 4. Lancement et Tests

### Exécution des tests unitaires & d'intégration
```bash
.\maven\apache-maven-3.9.6\bin\mvn.cmd test
```
*Résultat actuel : 10 tests exécutés avec succès (0 échec, 0 erreur).*

### Lancement de l'application
```bash
.\maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
```
- Port du serveur : `http://localhost:8083`
- Console H2 : `http://localhost:8083/h2-console` (URL: `jdbc:h2:mem:bdd_ressources`, user: `sa`, mot de passe vide)

---

## 📡 5. Endpoints de l'API REST

### Salles & Disponibilités
- `POST /api/salles` : Créer une salle (Admin)
- `PUT /api/salles/{id}` : Modifier une salle (Admin)
- `DELETE /api/salles/{id}` : Supprimer une salle (Admin)
- `GET /api/salles` : Liste de toutes les salles
- `GET /api/salles/{id}` : Détails d'une salle
- `GET /api/salles/disponibles?debut=...&fin=...&capaciteMin=...` : Recherche de salles libres

### Réservations
- `POST /api/reservations` : Demander une réservation (Enseignant/Responsable)
- `PUT /api/reservations/{id}` : Modifier une réservation en cours
- `DELETE /api/reservations/{id}` : Annuler une réservation
- `PUT /api/reservations/{id}/valider` : Valider la réservation (Responsable)
- `PUT /api/reservations/{id}/refuser` : Refuser la réservation avec motif (Responsable)
- `GET /api/reservations` : Liste de toutes les réservations
- `GET /api/reservations/mes-reservations` : Réservations de l'utilisateur connecté

### Inventaire & Équipements
- `POST /api/equipements` : Ajouter un équipement (Admin)
- `PUT /api/equipements/{id}` : Modifier un équipement
- `DELETE /api/equipements/{id}` : Supprimer un équipement
- `PUT /api/equipements/{id}/affecter` : Affecter à une salle ou un service
- `POST /api/equipements/signaler-panne` : Déclarer une panne (Tout utilisateur)
- `GET /api/equipements` : Consulter l'inventaire complet

### Interventions & Maintenance
- `POST /api/interventions/planifier` : Planifier une intervention (Responsable/Technicien)
- `GET /api/interventions` : Liste des interventions (filtrable par statut)
- `GET /api/interventions/technicien/{id}` : Interventions assignées à un technicien
- `PUT /api/interventions/{id}/traiter` : Prise en charge par le technicien
- `PUT /api/interventions/{id}/cloturer` : Clôture avec rapport technique
- `POST /api/interventions/declencher-preventives` : Déclenchement du contrôle préventif
