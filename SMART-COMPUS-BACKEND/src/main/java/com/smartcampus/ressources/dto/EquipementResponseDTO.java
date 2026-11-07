package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.entity.Equipement;
import com.smartcampus.ressources.enums.StatutEquipement;
import java.time.LocalDate;

public record EquipementResponseDTO(
    Long id,
    String idEquipement,
    String nom,
    String categorie,
    StatutEquipement statut,
    Long salleId,
    String salleNumero,
    String serviceAffecte,
    Integer periodiciteMaintenanceJours,
    LocalDate dateDerniereMaintenance,
    boolean disponible
) {
    public static EquipementResponseDTO fromEntity(Equipement eq) {
        return new EquipementResponseDTO(
            eq.getId(),
            eq.getIdEquipement(),
            eq.getNom(),
            eq.getCategorie(),
            eq.getStatut(),
            eq.getSalle() != null ? eq.getSalle().getId() : null,
            eq.getSalle() != null ? eq.getSalle().getNumero() : null,
            eq.getServiceAffecte(),
            eq.getPeriodiciteMaintenanceJours(),
            eq.getDateDerniereMaintenance(),
            eq.isDisponible()
        );
    }
}
