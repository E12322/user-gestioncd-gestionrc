package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record ReservationRequestDTO(
    @NotNull(message = "L'ID de la ressource est obligatoire")
    Long ressourceId,

    @NotNull(message = "La date de début est obligatoire")
    @Future(message = "La date de début doit être future")
    LocalDateTime dateDebut,

    @NotNull(message = "La date de fin est obligatoire")
    @Future(message = "La date de fin doit être future")
    LocalDateTime dateFin,

    @NotBlank(message = "Le motif est obligatoire")
    String motif,

    @Min(value = 1, message = "Le nombre de participants doit être supérieur à 0")
    int nombreParticipants,

    @NotNull(message = "L'ID du demandeur est obligatoire")
    Long demandeurId
) {}
