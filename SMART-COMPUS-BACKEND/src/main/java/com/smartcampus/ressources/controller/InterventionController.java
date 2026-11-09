package com.smartcampus.ressources.controller;

import com.smartcampus.ressources.security.CurrentUserArgumentResolver.*;
import com.smartcampus.ressources.dto.ClotureInterventionDTO;
import com.smartcampus.ressources.dto.InterventionRequestDTO;
import com.smartcampus.ressources.dto.InterventionResponseDTO;
import com.smartcampus.ressources.enums.StatutIntervention;
import com.smartcampus.ressources.service.IInterventionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/interventions")
public class InterventionController {

    private final IInterventionService interventionService;

    public InterventionController(IInterventionService interventionService) {
        this.interventionService = interventionService;
    }

    // BF3.16 : Planifier une intervention (corrective ou préventive)
    @PostMapping("/planifier")
    public ResponseEntity<InterventionResponseDTO> planifierIntervention(@Valid @RequestBody InterventionRequestDTO dto,
                                                                         @CurrentUserId Long planificateurId) {
        InterventionResponseDTO response = interventionService.planifierIntervention(dto, planificateurId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // BF3.13 & BF3.17 : Consulter les interventions / historique
    @GetMapping
    public ResponseEntity<List<InterventionResponseDTO>> getAllInterventions(
            @RequestParam(required = false) StatutIntervention statut) {
        if (statut != null) {
            return ResponseEntity.ok(interventionService.getInterventionsParStatut(statut));
        }
        return ResponseEntity.ok(interventionService.getAllInterventions());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InterventionResponseDTO> getIntervention(@PathVariable Long id) {
        return ResponseEntity.ok(interventionService.getIntervention(id));
    }

    // BF3.13 : Consulter les demandes affectées au technicien
    @GetMapping("/technicien/{technicienId}")
    public ResponseEntity<List<InterventionResponseDTO>> getInterventionsTechnicien(@PathVariable Long technicienId) {
        return ResponseEntity.ok(interventionService.getInterventionsTechnicien(technicienId));
    }

    // BF3.14 : Le technicien peut traiter les demandes de maintenance
    @PutMapping("/{id}/traiter")
    public ResponseEntity<InterventionResponseDTO> demarrerTraitement(@PathVariable Long id,
                                                                      @CurrentUserId Long technicienId) {
        return ResponseEntity.ok(interventionService.demarrerTraitement(id, technicienId));
    }

    // BF3.15 : Le technicien peut clôturer les demandes de maintenance
    @PutMapping("/{id}/cloturer")
    public ResponseEntity<InterventionResponseDTO> cloturerIntervention(@PathVariable Long id,
                                                                        @Valid @RequestBody ClotureInterventionDTO dto) {
        return ResponseEntity.ok(interventionService.cloturerIntervention(id, dto));
    }

    // BF3.16 : Déclenchement / vérification des maintenances préventives
    @PostMapping("/declencher-preventives")
    public ResponseEntity<List<InterventionResponseDTO>> declencherPreventives() {
        return ResponseEntity.ok(interventionService.verifierEtGenererMaintenancesPreventives());
    }
}
