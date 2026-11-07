package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.SalleRequestDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface ISalleService {
    SalleResponseDTO creerSalle(SalleRequestDTO dto, Long adminId);
    SalleResponseDTO modifierSalle(Long id, SalleRequestDTO dto, Long adminId);
    void supprimerSalle(Long id, Long adminId);
    SalleResponseDTO getSalle(Long id);
    List<SalleResponseDTO> getAllSalles();
    List<SalleResponseDTO> rechercherSallesLibres(LocalDateTime debut, LocalDateTime fin, int capaciteMin);
}
