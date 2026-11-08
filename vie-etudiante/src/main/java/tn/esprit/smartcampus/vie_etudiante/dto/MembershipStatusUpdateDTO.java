package tn.esprit.smartcampus.vie_etudiante.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MembershipStatusUpdateDTO {

    @NotBlank(message = "Le statut est obligatoire")
    @Pattern(regexp = "confirmed|refused", message = "Le statut doit être 'confirmed' ou 'refused'")
    private String status;
}
