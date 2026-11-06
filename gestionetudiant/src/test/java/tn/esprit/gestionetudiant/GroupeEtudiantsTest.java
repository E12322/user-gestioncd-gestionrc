package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.dto.EtudiantDTO;
import tn.esprit.gestionetudiant.dto.GroupeDTO;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.TypeSeance;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.service.IGroupeService;
import tn.esprit.gestionetudiant.service.ICoursService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Les classes (groupes) contiennent des étudiants : inscription contrôlée par la
 * capacité, pas de doublon, retrait fonctionnel, effectif correct dans les listes.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class GroupeEtudiantsTest {

    @Autowired
    private ICoursService coursService;
    @Autowired
    private IGroupeService groupeService;
    @Autowired
    private CoursRepository coursRepository;

    private Long creerCours(Integer capacite) {
        CoursDTO dto = new CoursDTO();
        dto.setIntitule("Cours classe test");
        dto.setCode("CLS-" + System.nanoTime());
        dto.setCapacite(capacite);
        return coursService.creerCours(dto).getId();
    }

    private Long creerClasse(Long coursId, String nom, int capacite) {
        GroupeDTO g = new GroupeDTO();
        g.setNom(nom);
        g.setType(TypeSeance.TD);
        g.setCoursId(coursId);
        g.setCapacite(capacite);
        return groupeService.creer(g).getId();
    }

    private EtudiantDTO etudiant(Long id, String nom) {
        return new EtudiantDTO(id, nom);
    }

    @Test
    void inscrireEtudiant_puisRelireEffectif() {
        Long coursId = creerCours(40);
        Long classeId = creerClasse(coursId, "4INFO-A", 30);

        groupeService.ajouterEtudiant(classeId, etudiant(101L, "Ahlem Guesmi"));
        groupeService.ajouterEtudiant(classeId, etudiant(102L, "Farah Yaich"));

        GroupeDTO relu = groupeService.consulterParId(classeId);
        assertThat(relu.getEffectif()).isEqualTo(2);
        assertThat(relu.getEtudiants()).extracting(EtudiantDTO::getNom)
                .containsExactlyInAnyOrder("Ahlem Guesmi", "Farah Yaich");

        // La liste paginée porte l'effectif et les membres (pas de N+1 sur les DTO)
        assertThat(groupeService.lister(null, 0, 20).content())
                .filteredOn(g -> g.getId().equals(classeId))
                .first()
                .satisfies(g -> {
                    assertThat(g.getEffectif()).isEqualTo(2);
                    assertThat(g.getEtudiants()).hasSize(2);
                });
    }

    @Test
    void inscrireEtudiant_classeComplete_409() {
        Long coursId = creerCours(40);
        Long classeId = creerClasse(coursId, "4INFO-B", 1);

        groupeService.ajouterEtudiant(classeId, etudiant(201L, "Premier Étudiant"));

        assertThatThrownBy(() -> groupeService.ajouterEtudiant(classeId, etudiant(202L, "Deuxième Étudiant")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("complète");
    }

    @Test
    void inscrireEtudiant_enDoublon_409_puisRetrait() {
        Long coursId = creerCours(40);
        Long classeId = creerClasse(coursId, "3INFO-A", 25);

        groupeService.ajouterEtudiant(classeId, etudiant(301L, "Étudiant Doublon"));

        assertThatThrownBy(() -> groupeService.ajouterEtudiant(classeId, etudiant(301L, "Étudiant Doublon")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("déjà");

        groupeService.retirerEtudiant(classeId, 301L);
        assertThat(groupeService.consulterParId(classeId).getEffectif()).isZero();
    }

    @Test
    void retraitEtudiantAbsent_404() {
        Long coursId = creerCours(40);
        Long classeId = creerClasse(coursId, "2INFO-A", 25);

        assertThatThrownBy(() -> groupeService.retirerEtudiant(classeId, 999L))
                .isInstanceOf(tn.esprit.gestionetudiant.exception.ResourceNotFoundException.class);
    }
}
