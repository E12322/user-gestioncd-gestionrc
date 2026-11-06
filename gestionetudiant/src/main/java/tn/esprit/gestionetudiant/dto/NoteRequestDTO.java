package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class NoteRequestDTO {

    @NotNull(message = "L'ID de l'enseignant est requis")
    private Long enseignantId;

    @NotNull(message = "L'ID de l'étudiant est requis")
    private Long etudiantId;

    @NotNull(message = "L'ID du cours est requis")
    private Long coursId;

    @Min(value = 0, message = "La note minimale est 0")
    @Max(value = 20, message = "La note maximale est 20")
    private float valeur;

    public NoteRequestDTO() {
    }

    public NoteRequestDTO(Long enseignantId, Long etudiantId, Long coursId, float valeur) {
        this.enseignantId = enseignantId;
        this.etudiantId = etudiantId;
        this.coursId = coursId;
        this.valeur = valeur;
    }

    public Long getEnseignantId() {
        return enseignantId;
    }

    public void setEnseignantId(Long enseignantId) {
        this.enseignantId = enseignantId;
    }

    public Long getEtudiantId() {
        return etudiantId;
    }

    public void setEtudiantId(Long etudiantId) {
        this.etudiantId = etudiantId;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public float getValeur() {
        return valeur;
    }

    public void setValeur(float valeur) {
        this.valeur = valeur;
    }
}
