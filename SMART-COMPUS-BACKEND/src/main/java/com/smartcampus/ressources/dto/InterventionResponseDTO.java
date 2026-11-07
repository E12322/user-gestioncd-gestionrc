package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.entity.Intervention;
import com.smartcampus.ressources.enums.StatutIntervention;
import com.smartcampus.ressources.enums.TypeIntervention;
import java.time.LocalDateTime;

public record InterventionResponseDTO(
    Long id,
    TypeIntervention typeIntervention,
    String description,
    Float coutEstime,
    StatutIntervention statut,
    Long technicienId,
    String technicienNom,
    Long equipementId,
    String equipementIdentifiant,
    String equipementNom,
    Long auteurSignalementId,
    String auteurSignalementNom,
    String rapportTechnique,
    LocalDateTime dateSignalement,
    LocalDateTime datePlanifiee,
    LocalDateTime dateDebutTraitement,
    LocalDateTime dateCloture
) {
    public static InterventionResponseDTO fromEntity(Intervention i) {
        return new InterventionResponseDTO(
            i.getId(),
            i.getTypeIntervention(),
            i.getDescription(),
            i.getCoutEstime(),
            i.getStatut(),
            i.getTechnicienId(),
            i.getTechnicienNom(),
            i.getEquipement().getId(),
            i.getEquipement().getIdEquipement(),
            i.getEquipement().getNom(),
            i.getAuteurSignalementId(),
            i.getAuteurSignalementNom(),
            i.getRapportTechnique(),
            i.getDateSignalement(),
            i.getDatePlanifiee(),
            i.getDateDebutTraitement(),
            i.getDateCloture()
        );
    }
}
