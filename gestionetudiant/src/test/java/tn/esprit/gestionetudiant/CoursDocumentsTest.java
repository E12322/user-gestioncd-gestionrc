package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.dto.DocumentDTO;
import tn.esprit.gestionetudiant.service.ICoursService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Supports pédagogiques d'un cours : la liste (PDF, PPTX, vidéo...) doit
 * persister en base et être relue intégralement, puis être remplaçable en bloc.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CoursDocumentsTest {

    @Autowired
    private ICoursService coursService;

    private static DocumentDTO support(String titre, String url, String nomFichier, String format) {
        DocumentDTO d = new DocumentDTO();
        d.setTitre(titre);
        d.setUrl(url);
        d.setNomFichier(nomFichier);
        d.setTaille("1,20 Mo");
        d.setFormat(format);
        return d;
    }

    private CoursDTO creerCoursAvecDocuments(List<DocumentDTO> documents) {
        CoursDTO dto = new CoursDTO();
        dto.setIntitule("Cours supports test");
        dto.setCode("SUP-" + System.nanoTime());
        dto.setDepartement("Informatique");
        dto.setDocuments(documents);
        return coursService.creerCours(dto);
    }

    @Test
    void creerCoursAvecDocuments_puisRelire() {
        CoursDTO cree = creerCoursAvecDocuments(List.of(
                support("Chapitre 1", "http://localhost:8080/uploads/a.pdf", "a.pdf", "PDF"),
                support("Diaporama", "http://localhost:8080/uploads/slides.pptx", "slides.pptx", "PPTX")));

        assertThat(cree.getDocuments()).hasSize(2);
        assertThat(cree.getDocuments()).extracting(DocumentDTO::getFormat).containsExactly("PDF", "PPTX");

        CoursDTO relu = coursService.consulterCoursParId(cree.getId());
        assertThat(relu.getDocuments()).hasSize(2);
        assertThat(relu.getDocuments().get(0).getUrl()).isEqualTo("http://localhost:8080/uploads/a.pdf");
        assertThat(relu.getDocuments().get(1).getTitre()).isEqualTo("Diaporama");

        // Liste complète : pas de doublon, chaque cours porte ses supports
        assertThat(coursService.consulterTousLesCours())
                .filteredOn(c -> c.getId().equals(cree.getId()))
                .allSatisfy(c -> assertThat(c.getDocuments()).hasSize(2));
    }

    @Test
    void modifierCours_remplaceLesDocuments() {
        CoursDTO cree = creerCoursAvecDocuments(List.of(
                support("Ancien PDF", "http://localhost:8080/uploads/ancien.pdf", "ancien.pdf", "PDF")));

        CoursDTO maj = new CoursDTO();
        maj.setIntitule("Cours supports test");
        maj.setDocuments(List.of(
                support("Nouveau PPTX", "http://localhost:8080/uploads/nouveau.pptx", "nouveau.pptx", "PPTX"),
                support("Vidéo", "http://localhost:8080/uploads/cours.mp4", "cours.mp4", "MP4")));

        CoursDTO modifie = coursService.modifierCours(cree.getId(), maj);
        assertThat(modifie.getDocuments()).hasSize(2);
        assertThat(modifie.getDocuments()).extracting(DocumentDTO::getTitre)
                .containsExactly("Nouveau PPTX", "Vidéo");

        // Relecture depuis la base : les anciens supports sont bien supprimés (orphanRemoval)
        CoursDTO relu = coursService.consulterCoursParId(cree.getId());
        assertThat(relu.getDocuments()).extracting(DocumentDTO::getNomFichier)
                .containsExactly("nouveau.pptx", "cours.mp4");
    }

    @Test
    void modifierCours_sansChampDocuments_conserveLesSupports() {
        CoursDTO cree = creerCoursAvecDocuments(List.of(
                support("Support conservé", "http://localhost:8080/uploads/keep.pdf", "keep.pdf", "PDF")));

        // Modification qui ne transporte pas la liste des supports (ex. renommage du cours)
        CoursDTO maj = new CoursDTO();
        maj.setIntitule("Cours supports renommé");

        CoursDTO modifie = coursService.modifierCours(cree.getId(), maj);
        assertThat(modifie.getDocuments()).hasSize(1);
        assertThat(modifie.getDocuments().get(0).getTitre()).isEqualTo("Support conservé");
    }
}
