package tn.esprit.smartcampus.vie_etudiante.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClubInputDTO {

    @NotBlank(message = "Le nom du club est obligatoire")
    private String name;

    @NotBlank(message = "La catégorie est obligatoire")
    private String category;

    @NotBlank(message = "La description est obligatoire")
    private String description;

    @NotBlank(message = "Le lieu de réunion est obligatoire")
    private String meetingPlace;

    @Min(value = 1, message = "Le nombre maximal de membres doit être supérieur à 0")
    private int maxMembers;
}
