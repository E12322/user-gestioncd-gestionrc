package tn.esprit.gestionetudiant.dto;

import java.time.LocalDate;

public class AbsenceResponseDTO {
    private Long id;
    private String seance;
    private LocalDate dateAbsence;
    private boolean justifiee;
    private Long etudiantId;
    private String etudiantNom;
    private Long coursId;
    private String coursIntitule;
    private long totalAbsencesCours;
    private boolean seuilDepasse;
    private String messageNotification;

    public AbsenceResponseDTO() {
    }

    public AbsenceResponseDTO(Long id, String seance, LocalDate dateAbsence, boolean justifiee,
                              Long etudiantId, String etudiantNom, Long coursId, String coursIntitule,
                              long totalAbsencesCours, boolean seuilDepasse, String messageNotification) {
        this.id = id;
        this.seance = seance;
        this.dateAbsence = dateAbsence;
        this.justifiee = justifiee;
        this.etudiantId = etudiantId;
        this.etudiantNom = etudiantNom;
        this.coursId = coursId;
        this.coursIntitule = coursIntitule;
        this.totalAbsencesCours = totalAbsencesCours;
        this.seuilDepasse = seuilDepasse;
        this.messageNotification = messageNotification;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public Long getEtudiantId() {
        return etudiantId;
    }

    public void setEtudiantId(Long etudiantId) {
        this.etudiantId = etudiantId;
    }

    public String getEtudiantNom() {
        return etudiantNom;
    }

    public void setEtudiantNom(String etudiantNom) {
        this.etudiantNom = etudiantNom;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public String getCoursIntitule() {
        return coursIntitule;
    }

    public void setCoursIntitule(String coursIntitule) {
        this.coursIntitule = coursIntitule;
    }

    public long getTotalAbsencesCours() {
        return totalAbsencesCours;
    }

    public void setTotalAbsencesCours(long totalAbsencesCours) {
        this.totalAbsencesCours = totalAbsencesCours;
    }

    public boolean isSeuilDepasse() {
        return seuilDepasse;
    }

    public void setSeuilDepasse(boolean seuilDepasse) {
        this.seuilDepasse = seuilDepasse;
    }

    public String getMessageNotification() {
        return messageNotification;
    }

    public void setMessageNotification(String messageNotification) {
        this.messageNotification = messageNotification;
    }
}
