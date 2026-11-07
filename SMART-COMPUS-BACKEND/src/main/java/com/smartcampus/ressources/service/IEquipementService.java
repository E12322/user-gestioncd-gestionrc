package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.*;

import java.util.List;

public interface IEquipementService {
    EquipementResponseDTO creerEquipement(EquipementRequestDTO dto, Long adminId);
    EquipementResponseDTO modifierEquipement(Long id, EquipementRequestDTO dto, Long adminId);
    void supprimerEquipement(Long id, Long adminId);
    EquipementResponseDTO affecterEquipement(Long id, AffectationEquipementDTO dto, Long adminId);
    EquipementResponseDTO getEquipement(Long id);
    List<EquipementResponseDTO> getAllEquipements();
    List<EquipementResponseDTO> getEquipementsParSalle(Long salleId);
    InterventionResponseDTO signalerPanne(SignalementPanneDTO dto);
}
