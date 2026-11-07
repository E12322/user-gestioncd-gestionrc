package tn.esprit.smartcampus.vie_etudiante.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventInputDTO {

    @NotBlank(message = "Le titre de l'événement est obligatoire")
    private String title;

    @NotBlank(message = "La description est obligatoire")
    private String description;

    @NotBlank(message = "La date est obligatoire")
    private String date; // "YYYY-MM-DD"

    @NotBlank(message = "L'heure de début est obligatoire")
    private String start; // "HH:MM"

    @NotBlank(message = "L'heure de fin est obligatoire")
    private String end; // "HH:MM"

    @NotBlank(message = "Le lieu est obligatoire")
    private String location;

    private String clubId;
}
