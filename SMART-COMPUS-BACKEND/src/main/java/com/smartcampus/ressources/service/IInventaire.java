package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.EquipementResponseDTO;
import com.smartcampus.ressources.dto.InterventionRequestDTO;
import com.smartcampus.ressources.dto.InterventionResponseDTO;
import com.smartcampus.ressources.dto.SignalementPanneDTO;

import java.util.List;

/**
 * Interface Façade du sous-module "Inventaire & Maintenance" (Slide 38, 45, 62).
 */
public interface IInventaire {

    void declarerPanne(Long equipementId, Long auteurId, String description);

    List<EquipementResponseDTO> consulterEquipements();

    InterventionResponseDTO planifierIntervention(InterventionRequestDTO dto, Long planificateurId);
}
