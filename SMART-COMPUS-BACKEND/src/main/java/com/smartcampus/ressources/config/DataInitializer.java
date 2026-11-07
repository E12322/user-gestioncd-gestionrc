package com.smartcampus.ressources.config;

import com.smartcampus.ressources.entity.*;
import com.smartcampus.ressources.enums.*;
import com.smartcampus.ressources.repository.EquipementRepository;
import com.smartcampus.ressources.repository.InterventionRepository;
import com.smartcampus.ressources.repository.ReservationRepository;
import com.smartcampus.ressources.repository.SalleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Configuration
@Profile("dev")
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    @Bean
    CommandLineRunner initDatabase(SalleRepository salleRepository,
                                  EquipementRepository equipementRepository,
                                  ReservationRepository reservationRepository,
                                  InterventionRepository interventionRepository) {
        return args -> {
            log.info("--- Initialisation des données SmartCampus alignées sur le Front-End ---");

            // 1. Salles identiques au front-end
            Salle amphiA = salleRepository.save(new Salle("AMP-A", "Amphi A", TypeRessource.AMPHITHEATRE, 220, "Bloc A", 0, true, true));
            Salle amphiB = salleRepository.save(new Salle("AMP-B", "Amphi B", TypeRessource.AMPHITHEATRE, 150, "Bloc A", 1, true, true));
            Salle salleC12 = salleRepository.save(new Salle("S-C12", "Salle C12", TypeRessource.SALLE_COURS, 40, "Bloc C", 1, true, false));
            Salle salleC14 = salleRepository.save(new Salle("S-C14", "Salle C14", TypeRessource.SALLE_COURS, 35, "Bloc C", 1, true, false));
            Salle laboRes = salleRepository.save(new Salle("LAB-RES", "Labo Réseaux", TypeRessource.LABORATOIRE, 30, "Bloc C", 0, true, true));
            Salle laboB = salleRepository.save(new Salle("LAB-B", "Labo B", TypeRessource.LABORATOIRE, 28, "Bloc B", 0, true, true));
            Salle conf = salleRepository.save(new Salle("CONF-D", "Salle de conférence", TypeRessource.SALLE_REUNION, 80, "Bloc D", 2, true, true));
            Salle reunionR1 = salleRepository.save(new Salle("REU-R1", "Salle de réunion R1", TypeRessource.SALLE_REUNION, 12, "Bloc D", 1, true, false));
            Salle projetP2 = salleRepository.save(new Salle("PROJ-P2", "Espace projet P2", TypeRessource.SALLE_REUNION, 16, "Bloc B", 1, true, false));

            // 2. Équipements
            Equipement proj1 = new Equipement("EQ-PROJ-01", "Vidéoprojecteur Laser 4K", "Projection", amphiA, "Audiovisuel", 90);
            proj1.setDateDerniereMaintenance(LocalDate.now().minusDays(100)); // pour test préventif
            equipementRepository.save(proj1);

            Equipement sonorisation = new Equipement("EQ-SONO-01", "Micro & Sonorisation HF", "Audio", amphiA, "Audiovisuel", 180);
            equipementRepository.save(sonorisation);

            Equipement switchReseau = new Equipement("EQ-SW-01", "Baie réseau et switchs Cisco", "Réseau", laboRes, "Informatique", 120);
            equipementRepository.save(switchReseau);

            Equipement visioconf = new Equipement("EQ-VISIO-01", "Visioconférence HD Polycom", "Vidéo", conf, "Audiovisuel", 180);
            equipementRepository.save(visioconf);

            // 3. Réservations d'exemple (identiques au seed de démonstration front-end)
            LocalDateTime dateDemain = LocalDateTime.now().plusDays(1);
            Reservation resKarim1 = new Reservation(
                    laboRes,
                    dateDemain.withHour(14).withMinute(0),
                    dateDemain.withHour(16).withMinute(0),
                    "TP supplémentaire — architecture des microservices",
                    28,
                    1L,
                    "Karim Trabelsi",
                    "karim.trabelsi@smartcampus.tn",
                    "ENSEIGNANT"
            );
            resKarim1.valider(5L);
            reservationRepository.save(resKarim1);

            LocalDateTime dateDans5Jours = LocalDateTime.now().plusDays(5);
            Reservation resKarim2 = new Reservation(
                    conf,
                    dateDans5Jours.withHour(9).withMinute(0),
                    dateDans5Jours.withHour(11).withMinute(30),
                    "Soutenances de projets",
                    60,
                    1L,
                    "Karim Trabelsi",
                    "karim.trabelsi@smartcampus.tn",
                    "ENSEIGNANT"
            );
            resKarim2.creerReservation(); // en attente
            reservationRepository.save(resKarim2);

            // 4. Intervention d'exemple
            Intervention int1 = new Intervention(
                    TypeIntervention.CORRECTIVE,
                    "Vérification connectique HDMI & optique",
                    50.0f,
                    proj1,
                    1L,
                    "Karim Trabelsi",
                    LocalDateTime.now().plusDays(2)
            );
            int1.demarrerTraitement(4L, "Karim Technicien");
            interventionRepository.save(int1);

            log.info("--- Initialisation terminée : 9 salles, 4 équipements, 2 réservations prêtes pour le Front-End ---");
        };
    }
}
