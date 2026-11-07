package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RefusReservationDTO(
    @NotNull(message = "L'ID du responsable est obligatoire")
    Long responsableId,

    @NotBlank(message = "Le motif du refus est obligatoire")
    String motifRefus
) {}
