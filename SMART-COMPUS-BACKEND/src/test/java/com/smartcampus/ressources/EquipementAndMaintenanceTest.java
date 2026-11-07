package com.smartcampus.ressources;

import com.smartcampus.ressources.dto.*;
import com.smartcampus.ressources.enums.StatutEquipement;
import com.smartcampus.ressources.enums.StatutIntervention;
import com.smartcampus.ressources.service.IEquipementService;
import com.smartcampus.ressources.service.IInterventionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
@Transactional
class EquipementAndMaintenanceTest {

    @Autowired
    private IEquipementService equipementService;

    @Autowired
    private IInterventionService interventionService;

    @Test
    @DisplayName("BF3.12 & Règle MM : Signalement d'une panne rend l'équipement indisponible")
    void testSignalementPanneEtIndisponibilite() {
        EquipementResponseDTO eq = equipementService.creerEquipement(new EquipementRequestDTO(
                "EQ-TEST-PANNE", "Caméra PTZ", "Vidéo", null, "Audiovisuel", 120
        ), 5L);

        assertTrue(eq.disponible());

        // Signalement de panne par un utilisateur
        InterventionResponseDTO intervention = equipementService.signalerPanne(new SignalementPanneDTO(
                eq.id(), 1L, "Lentille bloquée et surchauffe"
        ));

        assertNotNull(intervention);
        assertEquals(StatutIntervention.PLANIFIEE, intervention.statut());

        EquipementResponseDTO eqApresPanne = equipementService.getEquipement(eq.id());
        assertEquals(StatutEquipement.EN_PANNE, eqApresPanne.statut());
        assertFalse(eqApresPanne.disponible());
    }

    @Test
    @DisplayName("BF3.14 & BF3.15 : Traitement puis clôture de la maintenance remet l'équipement en service")
    void testTraitementEtClotureMaintenance() {
        EquipementResponseDTO eq = equipementService.creerEquipement(new EquipementRequestDTO(
                "EQ-TEST-CLOTURE", "Micro cravate", "Son", null, "Audio", 60
        ), 5L);

        InterventionResponseDTO intervention = equipementService.signalerPanne(new SignalementPanneDTO(
                eq.id(), 2L, "Batterie défectueuse"
        ));

        // BF3.14 : Le technicien (4L) démarre le traitement
        InterventionResponseDTO enCours = interventionService.demarrerTraitement(intervention.id(), 4L);
        assertEquals(StatutIntervention.EN_COURS, enCours.statut());
        assertEquals(4L, enCours.technicienId());

        // BF3.15 : Le technicien clôture l'intervention
        InterventionResponseDTO cloturee = interventionService.cloturerIntervention(
                intervention.id(),
                new ClotureInterventionDTO(4L, "Remplacement de l'accumulateur et tests audio OK.")
        );

        assertEquals(StatutIntervention.CLOTUREE, cloturee.statut());
        assertNotNull(cloturee.dateCloture());

        // L'équipement doit être redevenu opérationnel et disponible
        EquipementResponseDTO eqRemisEnService = equipementService.getEquipement(eq.id());
        assertEquals(StatutEquipement.OPERATIONNEL, eqRemisEnService.statut());
        assertTrue(eqRemisEnService.disponible());
    }
}
