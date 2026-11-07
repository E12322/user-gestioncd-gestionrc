package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;
import com.smartcampus.ressources.service.IReservationService;
import com.smartcampus.ressources.service.ISalleService;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implémentation du patron Façade pour IReservation.
 * Masque les détails internes (entités, contrôles multiples) et délègue aux services métiers.
 */
@Component
public class ReservationFacadeImpl implements IReservation {

    private final IReservationService reservationService;
    private final ISalleService salleService;

    public ReservationFacadeImpl(IReservationService reservationService, ISalleService salleService) {
        this.reservationService = reservationService;
        this.salleService = salleService;
    }

    @Override
    public ReservationResponseDTO creerReservation(ReservationRequestDTO dto) {
        return reservationService.demanderReservation(dto);
    }

    @Override
    public List<SalleResponseDTO> consulterDisponibilite(LocalDateTime debut, LocalDateTime fin, int capaciteMin) {
        return salleService.rechercherSallesLibres(debut, fin, capaciteMin);
    }

    @Override
    public void annulerReservation(Long reservationId, Long demandeurId) {
        reservationService.annulerReservation(reservationId, demandeurId);
    }

    @Override
    public ReservationResponseDTO validerReservation(Long reservationId, Long responsableId) {
        return reservationService.validerReservation(reservationId, responsableId);
    }

    @Override
    public ReservationResponseDTO refuserReservation(Long reservationId, Long responsableId, String motifRefus) {
        return reservationService.refuserReservation(reservationId, responsableId, motifRefus);
    }
}
