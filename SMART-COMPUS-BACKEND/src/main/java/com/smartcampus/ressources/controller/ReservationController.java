package com.smartcampus.ressources.controller;

import com.smartcampus.ressources.security.CurrentUserArgumentResolver.*;
import com.smartcampus.ressources.dto.RefusReservationDTO;
import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.service.IReservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/internal/reservations")
public class ReservationController {

    private final IReservationService reservationService;

    public ReservationController(IReservationService reservationService) {
        this.reservationService = reservationService;
    }

    // BF3.5 : L'enseignant peut demander une réservation
    @PostMapping
    public ResponseEntity<ReservationResponseDTO> demanderReservation(@Valid @RequestBody ReservationRequestDTO dto) {
        ReservationResponseDTO response = reservationService.demanderReservation(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // BF3.6 : L'enseignant peut modifier la réservation d'une salle
    @PutMapping("/{id}")
    public ResponseEntity<ReservationResponseDTO> modifierReservation(@PathVariable Long id,
                                                                     @Valid @RequestBody ReservationRequestDTO dto,
                                                                     @CurrentUserId Long demandeurId) {
        return ResponseEntity.ok(reservationService.modifierReservation(id, dto, demandeurId));
    }

    // BF3.7 : L'enseignant peut annuler la réservation d'une salle
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> annulerReservation(@PathVariable Long id,
                                                   @CurrentUserId Long demandeurId) {
        reservationService.annulerReservation(id, demandeurId);
        return ResponseEntity.noContent().build();
    }

    // BF3.8 : Le responsable peut valider une demande de réservation
    @PutMapping("/{id}/valider")
    public ResponseEntity<ReservationResponseDTO> validerReservation(@PathVariable Long id,
                                                                     @CurrentUserId Long responsableId) {
        return ResponseEntity.ok(reservationService.validerReservation(id, responsableId));
    }

    // BF3.9 : Le responsable peut refuser une demande de réservation
    @PutMapping("/{id}/refuser")
    public ResponseEntity<ReservationResponseDTO> refuserReservation(@PathVariable Long id,
                                                                     @Valid @RequestBody RefusReservationDTO dto) {
        return ResponseEntity.ok(reservationService.refuserReservation(id, dto.responsableId(), dto.motifRefus()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReservationResponseDTO> getReservation(@PathVariable Long id) {
        return ResponseEntity.ok(reservationService.getReservation(id));
    }

    @GetMapping
    public ResponseEntity<List<ReservationResponseDTO>> getAllReservations() {
        return ResponseEntity.ok(reservationService.getAllReservations());
    }

    @GetMapping("/mes-reservations")
    public ResponseEntity<List<ReservationResponseDTO>> getMesReservations(@CurrentUserId Long userId) {
        return ResponseEntity.ok(reservationService.getReservationsUtilisateur(userId));
    }
}
