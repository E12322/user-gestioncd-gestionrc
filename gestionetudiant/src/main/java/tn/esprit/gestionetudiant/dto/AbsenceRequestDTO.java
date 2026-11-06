package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class AbsenceRequestDTO {

    @NotNull(message = "L'ID de l'enseignant est requis")
    private Long enseignantId;

    @NotNull(message = "L'ID de l'étudiant est requis")
    private Long etudiantId;

    @NotNull(message = "L'ID du cours est requis")
    private Long coursId;

    @NotBlank(message = "La séance est requise")
    private String seance;

    private LocalDate dateAbsence;

    private boolean justifiee;

    public AbsenceRequestDTO() {
    }

    public AbsenceRequestDTO(Long enseignantId, Long etudiantId, Long coursId, String seance, LocalDate dateAbsence, boolean justifiee) {
        this.enseignantId = enseignantId;
        this.etudiantId = etudiantId;
        this.coursId = coursId;
        this.seance = seance;
        this.dateAbsence = dateAbsence;
        this.justifiee = justifiee;
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

    public String getSeance() {
        return seance;
    }

    public void setSeance(String seance) {
        this.seance = seance;
    }

    public LocalDate getDateAbsence() {
        return dateAbsence;
    }

    public void setDateAbsence(LocalDate dateAbsence) {
        this.dateAbsence = dateAbsence;
    }

    public boolean isJustifiee() {
        return justifiee;
    }

    public void setJustifiee(boolean justifiee) {
        this.justifiee = justifiee;
    }
}
