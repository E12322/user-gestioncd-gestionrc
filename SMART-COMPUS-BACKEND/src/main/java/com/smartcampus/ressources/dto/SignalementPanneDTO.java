package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SignalementPanneDTO(
    @NotNull(message = "L'ID de l'équipement est obligatoire")
    Long equipementId,

    @NotNull(message = "L'ID de l'auteur est obligatoire")
    Long auteurId,

    @NotBlank(message = "La description de la panne est obligatoire")
    String description
) {}
