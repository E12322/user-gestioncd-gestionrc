package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ClotureInterventionDTO(
    @NotNull(message = "L'ID du technicien est obligatoire")
    Long technicienId,

    @NotBlank(message = "Le rapport technique est obligatoire")
    String rapportTechnique
) {}
