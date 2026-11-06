package tn.esprit.gestionetudiant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.AnneeAcademiqueDTO;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.service.IAnneeAcademiqueService;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Règles métier des années académiques : libellé unique, une seule année
 * active, interdiction de supprimer l'année active.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AnneeAcademiqueServiceTest {

    @Autowired
    private IAnneeAcademiqueService anneeAcademiqueService;

    private AnneeAcademiqueDTO annee(String libelle, boolean active) {
        AnneeAcademiqueDTO dto = new AnneeAcademiqueDTO();
        dto.setLibelle(libelle);
        dto.setDateDebut(LocalDate.of(2025, 9, 15));
        dto.setDateFin(LocalDate.of(2026, 6, 30));
        dto.setActive(active);
        return dto;
    }

    @Test
    void refuseUnLibelleDuplique() {
        anneeAcademiqueService.creer(annee("2025-2026", false));

        assertThatThrownBy(() -> anneeAcademiqueService.creer(annee("2025-2026", false)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("existe déjà");
    }

    @Test
    void uneSeuleAnneePeutEtreActive() {
        AnneeAcademiqueDTO ancienne = anneeAcademiqueService.creer(annee("2024-2025", true));
        AnneeAcademiqueDTO nouvelle = anneeAcademiqueService.creer(annee("2025-2026", true));

        assertThat(anneeAcademiqueService.consulterAnneeActive().getLibelle()).isEqualTo("2025-2026");
        assertThat(anneeAcademiqueService.consulterParId(ancienne.getId()).isActive()).isFalse();
        assertThat(anneeAcademiqueService.consulterParId(nouvelle.getId()).isActive()).isTrue();
    }

    @Test
    void refuseUnePeriodeInversee() {
        AnneeAcademiqueDTO dto = annee("2025-2026", false);
        dto.setDateDebut(LocalDate.of(2026, 6, 30));
        dto.setDateFin(LocalDate.of(2025, 9, 15));

        assertThatThrownBy(() -> anneeAcademiqueService.creer(dto))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("antérieure");
    }

    @Test
    void refuseLaSuppressionDeLAnneeActive() {
        AnneeAcademiqueDTO active = anneeAcademiqueService.creer(annee("2025-2026", true));

        assertThatThrownBy(() -> anneeAcademiqueService.supprimer(active.getId()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("active");
    }
}
