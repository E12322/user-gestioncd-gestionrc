package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.EquipementResponseDTO;
import com.smartcampus.ressources.dto.InterventionRequestDTO;
import com.smartcampus.ressources.dto.InterventionResponseDTO;
import com.smartcampus.ressources.dto.SignalementPanneDTO;
import com.smartcampus.ressources.service.IEquipementService;
import com.smartcampus.ressources.service.IInterventionService;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Implémentation du patron Façade pour IInventaire.
 */
@Component
public class InventaireFacadeImpl implements IInventaire {

    private final IEquipementService equipementService;
    private final IInterventionService interventionService;

    public InventaireFacadeImpl(IEquipementService equipementService, IInterventionService interventionService) {
        this.equipementService = equipementService;
        this.interventionService = interventionService;
    }

    @Override
    public void declarerPanne(Long equipementId, Long auteurId, String description) {
        equipementService.signalerPanne(new SignalementPanneDTO(equipementId, auteurId, description));
    }

    @Override
    public List<EquipementResponseDTO> consulterEquipements() {
        return equipementService.getAllEquipements();
    }

    @Override
    public InterventionResponseDTO planifierIntervention(InterventionRequestDTO dto, Long planificateurId) {
        return interventionService.planifierIntervention(dto, planificateurId);
    }
}
