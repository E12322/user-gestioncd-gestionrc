package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.AffectationDTO;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.dto.GroupeDTO;
import tn.esprit.gestionetudiant.entity.TypeSeance;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.service.ICoursService;
import tn.esprit.gestionetudiant.service.IGroupeService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Une classe suit plusieurs cours (« Cours affectés ») : chaque affectation porte un
 * type de séance (CM/TD/TP), les doublons sont refusés et le retrait est immédiat.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class GroupeAffectationsTest {

    @Autowired
    private ICoursService coursService;
    @Autowired
    private IGroupeService groupeService;

    private Long creerCours(String code) {
        CoursDTO dto = new CoursDTO();
        dto.setIntitule("Cours " + code);
        dto.setCode(code + "-" + System.nanoTime());
        return coursService.creerCours(dto).getId();
    }

    @Test
    void creerClasse_affecteAutomatiquementSonCours() {
        Long coursId = creerCours("AUTOFILL");
        GroupeDTO g = new GroupeDTO();
        g.setNom("4INFO-B");
        g.setType(TypeSeance.TD);
        g.setCoursId(coursId);
        g.setCapacite(28);
        Long id = groupeService.creer(g).getId();

        GroupeDTO relu = groupeService.consulterParId(id);
        assertThat(relu.getAffectations()).hasSize(1);
        assertThat(relu.getAffectations().get(0).getCoursId()).isEqualTo(coursId);
        assertThat(relu.getAffectations().get(0).getType()).isEqualTo(TypeSeance.TD);
    }

    @Test
    void affecterPlusieursCours_doublonRefuse409_puisRetrait() {
        Long cours1 = creerCours("GENIE1");
        Long cours2 = creerCours("GENIE2");
        Long cours3 = creerCours("GENIE3");
        GroupeDTO g = new GroupeDTO();
        g.setNom("3INFO-A");
        g.setType(TypeSeance.TD);
        g.setCoursId(cours1);
        g.setCapacite(25);
        Long id = groupeService.creer(g).getId();

        groupeService.affecterCours(id, new AffectationDTO(cours2, TypeSeance.TP));
        groupeService.affecterCours(id, new AffectationDTO(cours3, TypeSeance.CM));

        GroupeDTO relu = groupeService.consulterParId(id);
        assertThat(relu.getAffectations()).hasSize(3);
        assertThat(relu.getAffectations()).extracting(AffectationDTO::getCoursId)
                .containsExactlyInAnyOrder(cours1, cours2, cours3);
        // Le libellé du cours et l'enseignant sont transportés (anti N+1 côté front)
        assertThat(relu.getAffectations()).allSatisfy(a -> assertThat(a.getCoursIntitule()).isNotBlank());

        // Doublon => 409
        assertThatThrownBy(() -> groupeService.affecterCours(id, new AffectationDTO(cours2, TypeSeance.TD)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("déjà affecté");

        // Retrait immédiat
        groupeService.retirerCours(id, cours2);
        assertThat(groupeService.consulterParId(id).getAffectations()).extracting(AffectationDTO::getCoursId)
                .containsExactlyInAnyOrder(cours1, cours3);
    }

    @Test
    void affecterCoursIntrouvable_404_etRetraitInconnu_404() {
        Long coursId = creerCours("INTR404");
        GroupeDTO g = new GroupeDTO();
        g.setNom("2INFO-B");
        g.setType(TypeSeance.TP);
        g.setCoursId(coursId);
        g.setCapacite(25);
        Long id = groupeService.creer(g).getId();

        assertThatThrownBy(() -> groupeService.affecterCours(id, new AffectationDTO(99999L, TypeSeance.TP)))
                .isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> groupeService.retirerCours(id, 99999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void supprimerClasse_sesAffectationsSontPurgees() {
        Long coursId = creerCours("DELGRP");
        Long autreCours = creerCours("DELGRP2");
        GroupeDTO g = new GroupeDTO();
        g.setNom("5INFO-C");
        g.setType(TypeSeance.TD);
        g.setCoursId(coursId);
        g.setCapacite(20);
        Long id = groupeService.creer(g).getId();
        groupeService.affecterCours(id, new AffectationDTO(autreCours, TypeSeance.CM));

        // La suppression ne doit pas échouer sur la FK des affectations.
        groupeService.supprimer(id);
        assertThatThrownBy(() -> groupeService.consulterParId(id))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
