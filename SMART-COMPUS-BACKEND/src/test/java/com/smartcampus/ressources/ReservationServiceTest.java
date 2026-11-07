package com.smartcampus.ressources;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.dto.SalleRequestDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;
import com.smartcampus.ressources.enums.StatutReservation;
import com.smartcampus.ressources.enums.TypeRessource;
import com.smartcampus.ressources.exception.AccesNonAutoriseException;
import com.smartcampus.ressources.exception.CapaciteDepasseeException;
import com.smartcampus.ressources.exception.ConflitReservationException;
import com.smartcampus.ressources.service.IReservationService;
import com.smartcampus.ressources.service.ISalleService;
import org.junit.jupiter.api.BeforeEach;
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
class ReservationServiceTest {

    @Autowired
    private IReservationService reservationService;

    @Autowired
    private ISalleService salleService;

    private SalleResponseDTO salleTest;

    @BeforeEach
    void setUp() {
        salleTest = salleService.creerSalle(new SalleRequestDTO(
                "S-TEST-1",
                "Salle de Test Unitaire",
                TypeRessource.SALLE_COURS,
                30,
                "Bâtiment Test",
                1,
                true,
                true
        ), 5L); // 5L = Admin
    }

    @Test
    @DisplayName("Règle RR : Un enseignant peut demander une réservation valide")
    void testDemandeReservationSucces() {
        LocalDateTime debut = LocalDateTime.now().plusDays(5).withHour(10).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(5).withHour(12).withMinute(0);

        ReservationRequestDTO dto = new ReservationRequestDTO(
                salleTest.id(),
                debut,
                fin,
                "Cours Algorithmique",
                25,
                1L // 1L = Enseignant
        );

        ReservationResponseDTO response = reservationService.demanderReservation(dto);

        assertNotNull(response);
        assertEquals(StatutReservation.DEMANDEE, response.statut());
        assertEquals("S-TEST-1", response.ressourceNumero());
    }

    @Test
    @DisplayName("Règle RR : Détection d'un conflit de double réservation sur le même créneau")
    void testConflitDoubleReservation() {
        LocalDateTime debut = LocalDateTime.now().plusDays(6).withHour(10).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(6).withHour(12).withMinute(0);

        ReservationRequestDTO dto1 = new ReservationRequestDTO(
                salleTest.id(), debut, fin, "Cours 1", 20, 1L);
        reservationService.demanderReservation(dto1);

        // Tentative sur un créneau chevauchant (11h - 13h)
        ReservationRequestDTO dto2 = new ReservationRequestDTO(
                salleTest.id(),
                LocalDateTime.now().plusDays(6).withHour(11).withMinute(0),
                LocalDateTime.now().plusDays(6).withHour(13).withMinute(0),
                "Cours 2 chevauchant",
                15,
                2L // Enseignant
        );

        assertThrows(ConflitReservationException.class, () -> reservationService.demanderReservation(dto2));
    }

    @Test
    @DisplayName("Règle RR : Dépassement de capacité maximale de la salle rejeté")
    void testDepassementCapacite() {
        LocalDateTime debut = LocalDateTime.now().plusDays(7).withHour(14).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(7).withHour(16).withMinute(0);

        // Capacité de la salle : 30. Demande pour 50 participants
        ReservationRequestDTO dto = new ReservationRequestDTO(
                salleTest.id(), debut, fin, "Grand amphi requis", 50, 1L);

        assertThrows(CapaciteDepasseeException.class, () -> reservationService.demanderReservation(dto));
    }

    @Test
    @DisplayName("Règle RR : Un étudiant ne peut pas demander la réservation d'une salle")
    void testAccesRefusePourEtudiant() {
        LocalDateTime debut = LocalDateTime.now().plusDays(8).withHour(10).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(8).withHour(12).withMinute(0);

        ReservationRequestDTO dto = new ReservationRequestDTO(
                salleTest.id(), debut, fin, "Soirée étudiante", 10, 6L // 6L = Etudiant
        );

        assertThrows(AccesNonAutoriseException.class, () -> reservationService.demanderReservation(dto));
    }

    @Test
    @DisplayName("Règle RR & BF3.8 : Le responsable peut valider une demande de réservation")
    void testValidationParResponsable() {
        LocalDateTime debut = LocalDateTime.now().plusDays(9).withHour(8).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(9).withHour(10).withMinute(0);

        ReservationRequestDTO dto = new ReservationRequestDTO(
                salleTest.id(), debut, fin, "Soutenance", 10, 1L);
        ReservationResponseDTO demandee = reservationService.demanderReservation(dto);

        ReservationResponseDTO validee = reservationService.validerReservation(demandee.id(), 3L); // 3L = Responsable

        assertEquals(StatutReservation.VALIDEE, validee.statut());
        assertEquals(3L, validee.valideurId());
    }

    @Test
    @DisplayName("BF3.4 : Recherche de salles disponibles selon date et capacité")
    void testRechercheSallesDisponibles() {
        LocalDateTime debut = LocalDateTime.now().plusDays(10).withHour(9).withMinute(0);
        LocalDateTime fin = LocalDateTime.now().plusDays(10).withHour(11).withMinute(0);

        List<SalleResponseDTO> disponibles = salleService.rechercherSallesLibres(debut, fin, 25);
        assertFalse(disponibles.isEmpty());
        assertTrue(disponibles.stream().anyMatch(s -> s.numero().equals("S-TEST-1")));
    }
}
