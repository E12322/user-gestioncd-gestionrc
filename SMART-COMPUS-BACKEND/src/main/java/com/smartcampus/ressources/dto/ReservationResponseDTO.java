package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.entity.Reservation;
import com.smartcampus.ressources.enums.StatutReservation;
import java.time.LocalDateTime;

public record ReservationResponseDTO(
    Long id,
    Long ressourceId,
    String ressourceNumero,
    String ressourceNom,
    LocalDateTime dateDebut,
    LocalDateTime dateFin,
    String motif,
    int nombreParticipants,
    StatutReservation statut,
    Long demandeurId,
    String demandeurNom,
    String demandeurEmail,
    String demandeurRole,
    Long valideurId,
    String motifRefus,
    LocalDateTime dateDemande,
    LocalDateTime dateDecision
) {
    public static ReservationResponseDTO fromEntity(Reservation reservation) {
        return new ReservationResponseDTO(
            reservation.getId(),
            reservation.getRessource().getId(),
            reservation.getRessource().getNumero(),
            reservation.getRessource().getNom(),
            reservation.getDateDebut(),
            reservation.getDateFin(),
            reservation.getMotif(),
            reservation.getNombreParticipants(),
            reservation.getStatut(),
            reservation.getDemandeurId(),
            reservation.getDemandeurNom(),
            reservation.getDemandeurEmail(),
            reservation.getDemandeurRole(),
            reservation.getValideurId(),
            reservation.getMotifRefus(),
            reservation.getDateDemande(),
            reservation.getDateDecision()
        );
    }
}
