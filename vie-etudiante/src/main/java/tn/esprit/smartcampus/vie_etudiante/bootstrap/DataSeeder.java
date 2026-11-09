package tn.esprit.smartcampus.vie_etudiante.bootstrap;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final EventRepository eventRepository;

    @Override
    public void run(String... args) {
        if (clubRepository.count() > 0) {
            log.info("Base de données smartcampus_student_life déjà initialisée.");
            return;
        }

        log.info("Initialisation de la base smartcampus_student_life avec les données de démonstration...");

        // 1. Clubs
        Club c1 = Club.builder().id("k1").name("Club Robotique").category("Technologie").members(48).maxMembers(60)
                .meetingPlace("Labo B, Bloc B")
                .description("Conception et programmation de robots, participation aux concours nationaux et ateliers d'initiation ouverts à tous.")
                .build();
        Club c2 = Club.builder().id("k2").name("Club Théâtre").category("Arts").members(30).maxMembers(30)
                .meetingPlace("Amphi B, Bloc A")
                .description("Ateliers d'improvisation, mise en scène et représentations de fin de semestre devant le campus.")
                .build();
        Club c3 = Club.builder().id("k3").name("Club Photographie").category("Arts").members(22).maxMembers(40)
                .meetingPlace("Salle C14, Bloc C")
                .description("Sorties photo, retouche et expositions. Du smartphone au reflex, tous les niveaux sont accueillis.")
                .build();
        Club c4 = Club.builder().id("k4").name("Club Échecs").category("Culture").members(18).maxMembers(25)
                .meetingPlace("Espace projet P2, Bloc B")
                .description("Parties libres, tournois internes et préparation aux compétitions universitaires.")
                .build();
        Club c5 = Club.builder().id("k5").name("Club Football").category("Sport").members(54).maxMembers(70)
                .meetingPlace("Terrain du campus")
                .description("Entraînements hebdomadaires, championnat inter-écoles et matchs amicaux.")
                .build();
        Club c6 = Club.builder().id("k6").name("Solidarité Campus").category("Solidarité").members(36).maxMembers(80)
                .meetingPlace("Salle C12, Bloc C")
                .description("Collectes, tutorat entre étudiants et actions de bénévolat avec des associations locales.")
                .build();
        Club c7 = Club.builder().id("k7").name("Club IA & Data").category("Technologie").members(41).maxMembers(50)
                .meetingPlace("Labo Réseaux, Bloc C")
                .description("Projets d'apprentissage automatique, lectures d'articles et hackathons de données.")
                .build();

        clubRepository.saveAll(List.of(c1, c2, c3, c4, c5, c6, c7));

        // 2. Adhésions
        Membership m1 = Membership.builder().id("m-1").clubId("k1").clubName("Club Robotique").memberId("ETU-2024-0187")
                .memberName("Yasmine Ben Salah").memberRole("student").status("confirmed").requestedAt(isoDaysAgo(60)).decidedAt(isoDaysAgo(59)).build();
        Membership m2 = Membership.builder().id("m-2").clubId("k3").clubName("Club Photographie").memberId("ETU-2024-0187")
                .memberName("Yasmine Ben Salah").memberRole("student").status("pending").requestedAt(isoDaysAgo(2)).build();
        Membership m3 = Membership.builder().id("m-3").clubId("k1").clubName("Club Robotique").memberId("ETU-2024-0211")
                .memberName("Amine Khelifi").memberRole("student").status("confirmed").requestedAt(isoDaysAgo(55)).decidedAt(isoDaysAgo(54)).build();
        Membership m4 = Membership.builder().id("m-4").clubId("k1").clubName("Club Robotique").memberId("ETU-2024-0455")
                .memberName("Mariem Sfaxi").memberRole("student").status("confirmed").requestedAt(isoDaysAgo(40)).decidedAt(isoDaysAgo(39)).build();
        Membership m5 = Membership.builder().id("m-5").clubId("k7").clubName("Club IA & Data").memberId("ENS-0042")
                .memberName("Karim Trabelsi").memberRole("teacher").status("confirmed").requestedAt(isoDaysAgo(30)).decidedAt(isoDaysAgo(29)).build();
        Membership m6 = Membership.builder().id("m-6").clubId("k7").clubName("Club IA & Data").memberId("ENS-0017")
                .memberName("Salma Ayari").memberRole("teacher").status("confirmed").requestedAt(isoDaysAgo(25)).decidedAt(isoDaysAgo(24)).build();
        Membership m7 = Membership.builder().id("m-7").clubId("k2").clubName("Club Théâtre").memberId("ETU-2024-0302")
                .memberName("Inès Bouzid").memberRole("student").status("confirmed").requestedAt(isoDaysAgo(45)).decidedAt(isoDaysAgo(44)).build();
        Membership m8 = Membership.builder().id("m-8").clubId("k4").clubName("Club Échecs").memberId("ETU-2024-0211")
                .memberName("Amine Khelifi").memberRole("student").status("pending").requestedAt(isoDaysAgo(3)).build();
        Membership m9 = Membership.builder().id("m-9").clubId("k5").clubName("Club Football").memberId("ETU-2023-0644")
                .memberName("Omar Dridi").memberRole("student").status("pending").requestedAt(isoDaysAgo(2)).build();
        Membership m10 = Membership.builder().id("m-10").clubId("k6").clubName("Solidarité Campus").memberId("ETU-2025-0019")
                .memberName("Rim Zouari").memberRole("student").status("pending").requestedAt(isoDaysAgo(1)).build();
        Membership m11 = Membership.builder().id("m-11").clubId("k7").clubName("Club IA & Data").memberId("ETU-2024-0302")
                .memberName("Inès Bouzid").memberRole("student").status("pending").requestedAt(isoDaysAgo(1)).build();
        Membership m12 = Membership.builder().id("m-12").clubId("k3").clubName("Club Photographie").memberId("ETU-2023-0644")
                .memberName("Omar Dridi").memberRole("student").status("refused").requestedAt(isoDaysAgo(12)).decidedAt(isoDaysAgo(11)).build();

        membershipRepository.saveAll(List.of(m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12));

        // 3. Événements
        CampusEvent ev1 = CampusEvent.builder().id("ev-1").title("Journée d'accueil des clubs")
                .description("Tous les clubs présentent leurs activités. Venez les rencontrer et vous inscrire.")
                .date(dayPlus(2)).start("10:00").end("16:00").location("Esplanade du campus").build();

        CampusEvent ev2 = CampusEvent.builder().id("ev-2").title("Atelier : premiers pas en robotique")
                .description("Assemblage d'un robot suiveur de ligne. Aucun prérequis.")
                .date(dayPlus(3)).start("14:00").end("17:00").location("Labo B, Bloc B").clubId("k1").clubName("Club Robotique").build();

        CampusEvent ev3 = CampusEvent.builder().id("ev-3").title("Tournoi d'échecs du semestre")
                .description("Tournoi en 5 rondes ouvert à tous les niveaux.")
                .date(dayPlus(5)).start("13:30").end("18:00").location("Espace projet P2, Bloc B").clubId("k4").clubName("Club Échecs").build();

        CampusEvent ev4 = CampusEvent.builder().id("ev-4").title("Représentation : « Le Malade imaginaire »")
                .description("Soirée de théâtre ouverte à toute la communauté du campus.")
                .date(dayPlus(8)).start("18:30").end("20:30").location("Amphi B, Bloc A").clubId("k2").clubName("Club Théâtre").build();

        CampusEvent ev5 = CampusEvent.builder().id("ev-5").title("Collecte de fournitures scolaires")
                .description("Déposez cahiers et stylos pour les écoles partenaires.")
                .date(dayPlus(9)).start("09:00").end("15:00").location("Hall du Bloc C").clubId("k6").clubName("Solidarité Campus").build();

        CampusEvent ev6 = CampusEvent.builder().id("ev-6").title("Hackathon de données")
                .description("Une journée pour résoudre un défi de données avec des équipes de quatre.")
                .date(dayPlus(14)).start("09:00").end("19:00").location("Labo Réseaux, Bloc C").clubId("k7").clubName("Club IA & Data").build();

        CampusEvent ev7 = CampusEvent.builder().id("ev-7").title("Match inter-écoles")
                .description("Rencontre amicale contre l'école voisine.")
                .date(dayPlus(16)).start("15:00").end("17:00").location("Terrain du campus").clubId("k5").clubName("Club Football").build();

        eventRepository.saveAll(List.of(ev1, ev2, ev3, ev4, ev5, ev6, ev7));
        log.info("Initialisation terminée avec succès.");
    }

    private String dayPlus(int days) {
        return LocalDate.now().plusDays(days).format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    private String isoDaysAgo(int days) {
        return LocalDate.now().minusDays(days).atStartOfDay().format(DateTimeFormatter.ISO_LOCAL_DATE) + "T10:00:00.000Z";
    }
}
