package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;

import java.util.List;

public interface IReservationService {
    ReservationResponseDTO demanderReservation(ReservationRequestDTO dto);
    ReservationResponseDTO modifierReservation(Long reservationId, ReservationRequestDTO dto, Long demandeurId);
    void annulerReservation(Long reservationId, Long demandeurId);
    ReservationResponseDTO validerReservation(Long reservationId, Long responsableId);
    ReservationResponseDTO refuserReservation(Long reservationId, Long responsableId, String motifRefus);
    ReservationResponseDTO getReservation(Long id);
    List<ReservationResponseDTO> getReservationsUtilisateur(Long demandeurId);
    List<ReservationResponseDTO> getAllReservations();
}
