package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Décision de l'administrateur sur une demande : "validated" ou "refused"
 * (valeurs du front, alignées sur Inscription.STATUT_*).
 */
public class InscriptionDecisionDTO {

    @NotBlank(message = "Le statut est obligatoire")
    private String status;

    public InscriptionDecisionDTO() {
    }

    public InscriptionDecisionDTO(String status) {
        this.status = status;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
