package com.smartcampus.ressources.dto;

import com.smartcampus.ressources.enums.TypeRessource;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SalleRequestDTO(
    @NotBlank(message = "Le numéro de la salle est obligatoire")
    String numero,

    @NotBlank(message = "Le nom de la salle est obligatoire")
    String nom,

    @NotNull(message = "Le type de ressource est obligatoire")
    TypeRessource type,

    @Min(value = 1, message = "La capacité minimale doit être d'au moins 1 personne")
    int capacite,

    @NotBlank(message = "Le bâtiment est obligatoire")
    String batiment,

    int etage,

    boolean projecteur,

    boolean climatisee
) {}
