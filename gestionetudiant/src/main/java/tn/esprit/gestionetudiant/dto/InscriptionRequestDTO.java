package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.NotNull;

/** Corps d'une demande d'inscription : le cours visé. */
public class InscriptionRequestDTO {

    @NotNull(message = "L'identifiant du cours est obligatoire")
    private Long coursId;

    public InscriptionRequestDTO() {
    }

    public InscriptionRequestDTO(Long coursId) {
        this.coursId = coursId;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }
}
