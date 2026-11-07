package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.enums.TypeIntervention;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record InterventionRequestDTO(
    @NotNull(message = "Le type d'intervention est obligatoire")
    TypeIntervention typeIntervention,

    @NotBlank(message = "La description est obligatoire")
    String description,

    Float coutEstime,

    @NotNull(message = "L'ID de l'équipement est obligatoire")
    Long equipementId,

    @NotNull(message = "La date planifiée est obligatoire")
    @FutureOrPresent(message = "La date planifiée doit être future ou présente")
    LocalDateTime datePlanifiee,

    @NotNull(message = "L'ID de l'auteur de la demande est obligatoire")
    Long auteurId
) {}
