package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.enums.TypeRessource;

public record SalleResponseDTO(
    Long id,
    String numero,
    String nom,
    TypeRessource type,
    int capacite,
    String batiment,
    int etage,
    boolean projecteur,
    boolean climatisee,
    boolean disponible
) {
    public static SalleResponseDTO fromEntity(Salle salle) {
        return new SalleResponseDTO(
            salle.getId(),
            salle.getNumero(),
            salle.getNom(),
            salle.getType(),
            salle.getCapacite(),
            salle.getBatiment(),
            salle.getEtage(),
            salle.isProjecteur(),
            salle.isClimatisee(),
            salle.isDisponible()
        );
    }
}
