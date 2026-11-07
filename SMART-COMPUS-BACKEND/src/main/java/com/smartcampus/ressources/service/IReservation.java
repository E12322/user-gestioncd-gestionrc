package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Interface Façade du sous-module "Réservation & Planification"
 * Exposée aux modules externes (ex: Module Gestion de la Vie Étudiante - Slide 38, 45, 62).
 */
public interface IReservation {

    ReservationResponseDTO creerReservation(ReservationRequestDTO dto);

    List<SalleResponseDTO> consulterDisponibilite(LocalDateTime debut, LocalDateTime fin, int capaciteMin);

    void annulerReservation(Long reservationId, Long demandeurId);

    ReservationResponseDTO validerReservation(Long reservationId, Long responsableId);

    ReservationResponseDTO refuserReservation(Long reservationId, Long responsableId, String motifRefus);
}
