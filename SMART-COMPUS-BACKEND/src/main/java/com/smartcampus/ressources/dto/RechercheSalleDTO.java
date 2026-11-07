package com.smartcampus.ressources.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record RechercheSalleDTO(
    @NotNull(message = "La date de début est obligatoire")
    @Future(message = "La date de début doit être dans le futur")
    LocalDateTime dateDebut,

    @NotNull(message = "La date de fin est obligatoire")
    @Future(message = "La date de fin doit être dans le futur")
    LocalDateTime dateFin,

    @Min(value = 1, message = "La capacité minimale recherchée doit être supérieure à 0")
    int capaciteMin
) {}
