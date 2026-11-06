package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SeanceDTO;
import tn.esprit.gestionetudiant.dto.SeanceRequestDTO;
import tn.esprit.gestionetudiant.entity.AffectationCours;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.Groupe;
import tn.esprit.gestionetudiant.entity.Salle;
import tn.esprit.gestionetudiant.entity.TypeSeance;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.repository.AffectationCoursRepository;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.GroupeRepository;
import tn.esprit.gestionetudiant.repository.SalleRepository;
import tn.esprit.gestionetudiant.service.ISeanceService;

import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Règles métier de l'emploi du temps : créneaux, conflits de salle /
 * d'enseignant / de groupe, appartenance du groupe au cours.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SeanceServiceTest {

    @Autowired
    private ISeanceService seanceService;
    @Autowired
    private CoursRepository coursRepository;
    @Autowired
    private SalleRepository salleRepository;
    @Autowired
    private GroupeRepository groupeRepository;
    @Autowired
    private AffectationCoursRepository affectationCoursRepository;

    private Long coursId;
    private Long salleAId;
    private Long salleBId;
    private Long groupeId;

    @BeforeEach
    void setUp() {
        Cours cours = new Cours();
        cours.setCode("SEC-401");
        cours.setIntitule("Sécurité des applications web");
        cours.setCapacite(40);
        cours = coursRepository.save(cours);

        Salle salleA = new Salle();
        salleA.setNom("A-101");
        salleA.setBatiment("Bloc A");
        salleA.setCapacite(30);
        salleA = salleRepository.save(salleA);

        Salle salleB = new Salle();
        salleB.setNom("B-202");
        salleB.setBatiment("Bloc B");
        salleB.setCapacite(30);
        salleB = salleRepository.save(salleB);

        Groupe groupe = new Groupe();
        groupe.setNom("G1");
        groupe.setType(TypeSeance.TD);
        groupe.setCapacite(20);
        groupe.setCours(cours);
        groupe = groupeRepository.save(groupe);

        coursId = cours.getId();
        salleAId = salleA.getId();
        salleBId = salleB.getId();
        groupeId = groupe.getId();
    }

    private SeanceRequestDTO requete(Long salleId, LocalTime debut, LocalTime fin) {
        SeanceRequestDTO dto = new SeanceRequestDTO();
        dto.setCoursId(coursId);
        dto.setGroupeId(groupeId);
        dto.setSalleId(salleId);
        dto.setEnseignantId(42L);
        dto.setType(TypeSeance.TD);
        dto.setJour(1);
        dto.setHeureDebut(debut);
        dto.setHeureFin(fin);
        return dto;
    }

    @Test
    void creeUneSeanceEtLaRestitue() {
        SeanceDTO dto = seanceService.creer(requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        assertThat(dto.getId()).isNotNull();
        assertThat(dto.getCoursCode()).isEqualTo("SEC-401");
        assertThat(dto.getSalleNom()).isEqualTo("A-101");
        assertThat(dto.getGroupeNom()).isEqualTo("G1");
    }

    @Test
    void refuseLeChevauchementSurLaMemeSalle() {
        seanceService.creer(requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        assertThatThrownBy(() -> seanceService.creer(requete(salleAId, LocalTime.of(9, 0), LocalTime.of(11, 0))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Conflit d'emploi du temps");
    }

    @Test
    void accepteLesCreneauxJuxtaposes() {
        seanceService.creer(requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        assertThatCode(() -> seanceService.creer(requete(salleAId, LocalTime.of(10, 0), LocalTime.of(12, 0))))
                .doesNotThrowAnyException();
    }

    @Test
    void refuseLeChevauchementPourLeMemeEnseignantDansUneAutreSalle() {
        seanceService.creer(requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        assertThatThrownBy(() -> seanceService.creer(requete(salleBId, LocalTime.of(9, 0), LocalTime.of(11, 0))))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("enseignant");
    }

    @Test
    void refuseUnePlageHoraireInversee() {
        assertThatThrownBy(() -> seanceService.creer(requete(salleAId, LocalTime.of(10, 0), LocalTime.of(8, 0))))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("antérieure");
    }

    @Test
    void refuseUnGroupeDUnAutreCours() {
        Cours autreCours = new Cours();
        autreCours.setCode("WEB-301");
        autreCours.setIntitule("Développement web");
        autreCours = coursRepository.save(autreCours);

        SeanceRequestDTO dto = requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0));
        dto.setCoursId(autreCours.getId());

        assertThatThrownBy(() -> seanceService.creer(dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("n'appartient pas");
    }

    @Test
    void accepteUnGroupeSuivantLeCoursParAffectation() {
        Cours autreCours = new Cours();
        autreCours.setCode("WEB-301");
        autreCours.setIntitule("Développement web");
        autreCours = coursRepository.save(autreCours);

        AffectationCours affectation = new AffectationCours();
        affectation.setGroupe(groupeRepository.findById(groupeId).orElseThrow());
        affectation.setCours(autreCours);
        affectation.setType(TypeSeance.CM);
        affectationCoursRepository.save(affectation);

        SeanceRequestDTO dto = requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0));
        dto.setCoursId(autreCours.getId());
        dto.setType(TypeSeance.CM);

        SeanceDTO seance = seanceService.creer(dto);
        assertThat(seance.getId()).isNotNull();
        assertThat(seance.getCoursCode()).isEqualTo("WEB-301");
    }

    @Test
    void listeAvecFiltreParJour() {
        seanceService.creer(requete(salleAId, LocalTime.of(8, 0), LocalTime.of(10, 0)));

        PageResponse<SeanceDTO> lundi = seanceService.lister(null, null, null, null, 1, 0, 20);
        PageResponse<SeanceDTO> mercredi = seanceService.lister(null, null, null, null, 3, 0, 20);

        assertThat(lundi.content()).hasSize(1);
        assertThat(lundi.totalElements()).isEqualTo(1);
        assertThat(mercredi.content()).isEmpty();
    }
}
