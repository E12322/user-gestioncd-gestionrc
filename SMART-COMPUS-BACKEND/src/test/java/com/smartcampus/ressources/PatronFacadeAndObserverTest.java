package com.smartcampus.ressources;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.dto.SalleRequestDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;
import com.smartcampus.ressources.entity.AuditLog;
import com.smartcampus.ressources.enums.StatutReservation;
import com.smartcampus.ressources.enums.TypeRessource;
import com.smartcampus.ressources.service.IInventaire;
import com.smartcampus.ressources.service.IReservation;
import com.smartcampus.ressources.repository.AuditLogRepository;
import com.smartcampus.ressources.service.ISalleService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("dev")
@Transactional
class PatronFacadeAndObserverTest {

    @Autowired
    private IReservation reservationFacade;

    @Autowired
    private IInventaire inventaireFacade;

    @Autowired
    private ISalleService salleService;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Test
    @DisplayName("Patron Façade (Slide 62) : Utilisation simplifiée de IReservation sans exposer les classes internes")
    void testFacadeReservation() {
        SalleResponseDTO salle = salleService.creerSalle(new SalleRequestDTO(
                "S-FACADE-01", "Salle Polyvalente", TypeRessource.SALLE_REUNION, 20, "Bâtiment B", 1, false, true
        ), 5L);

        LocalDateTime debut = LocalDateTime.now().plusDays(12).withHour(14).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(12).withHour(16).withMinute(0);

        // Appel direct via la Façade IReservation
        ReservationResponseDTO reservation = reservationFacade.creerReservation(new ReservationRequestDTO(
                salle.id(), debut, fin, "Réunion Club Robotique", 12, 1L
        ));

        assertNotNull(reservation);
        assertEquals(StatutReservation.DEMANDEE, reservation.statut());

        // Validation via la Façade
        ReservationResponseDTO validee = reservationFacade.validerReservation(reservation.id(), 3L);
        assertEquals(StatutReservation.VALIDEE, validee.statut());
    }

    @Test
    @DisplayName("Patron Observateur (Slide 63) & BNF.8 : Journalisation automatique de l'audit")
    void testObservateurAudit() {
        SalleResponseDTO salle = salleService.creerSalle(new SalleRequestDTO(
                "S-OBS-01", "Salle Audit", TypeRessource.SALLE_COURS, 25, "Bâtiment C", 1, true, false
        ), 5L);

        LocalDateTime debut = LocalDateTime.now().plusDays(14).withHour(8).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(14).withHour(10).withMinute(0);

        ReservationResponseDTO res = reservationFacade.creerReservation(new ReservationRequestDTO(
                salle.id(), debut, fin, "Examen Partiel", 20, 1L
        ));

        // Vérification que le JournalAuditObserver a bien persisté l'opération sensible
        List<AuditLog> logs = auditLogRepository.findByTypeEntiteAndEntiteIdOrderByDateActionDesc("Reservation", res.id());
        assertFalse(logs.isEmpty(), "Un journal d'audit doit être généré pour la réservation (BNF.8)");
        assertTrue(logs.stream().anyMatch(l -> l.getAction().contains("RESERVATION_CREEE")));
    }
}
