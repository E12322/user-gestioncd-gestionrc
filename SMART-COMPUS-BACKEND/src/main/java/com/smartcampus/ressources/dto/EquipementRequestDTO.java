package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.NotBlank;

public record EquipementRequestDTO(
    @NotBlank(message = "L'identifiant métier de l'équipement est obligatoire")
    String idEquipement,

    @NotBlank(message = "Le nom de l'équipement est obligatoire")
    String nom,

    @NotBlank(message = "La catégorie est obligatoire")
    String categorie,

    Long salleId,

    String serviceAffecte,

    Integer periodiciteMaintenanceJours
) {}
