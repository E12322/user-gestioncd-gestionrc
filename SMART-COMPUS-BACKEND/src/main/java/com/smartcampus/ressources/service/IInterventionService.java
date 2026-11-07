package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ClotureInterventionDTO;
import com.smartcampus.ressources.dto.InterventionRequestDTO;
import com.smartcampus.ressources.dto.InterventionResponseDTO;
import com.smartcampus.ressources.enums.StatutIntervention;

import java.util.List;

public interface IInterventionService {
    InterventionResponseDTO planifierIntervention(InterventionRequestDTO dto, Long planificateurId);
    InterventionResponseDTO demarrerTraitement(Long interventionId, Long technicienId);
    InterventionResponseDTO cloturerIntervention(Long interventionId, ClotureInterventionDTO dto);
    InterventionResponseDTO getIntervention(Long id);
    List<InterventionResponseDTO> getAllInterventions();
    List<InterventionResponseDTO> getInterventionsTechnicien(Long technicienId);
    List<InterventionResponseDTO> getInterventionsParStatut(StatutIntervention statut);
    List<InterventionResponseDTO> verifierEtGenererMaintenancesPreventives();
}
