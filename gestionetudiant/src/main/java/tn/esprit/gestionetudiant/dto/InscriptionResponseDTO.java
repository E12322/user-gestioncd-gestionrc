package tn.esprit.gestionetudiant.dto;

import java.time.Instant;

/**
 * Inscription vue par le front (champs exacts du type {@code Enrollment}) :
 * le cours et l'étudiant sont numériques côté microservice académique.
 */
public class InscriptionResponseDTO {

    private Long id;
    private Long coursId;
    private Long etudiantId;
    /** pending | validated | refused */
    private String status;
    /** GROUPE | LIBRE */
    private String source;
    private Long groupeId;
    private Instant requestedAt;
    private Instant decidedAt;

    public InscriptionResponseDTO() {
    }

    public InscriptionResponseDTO(Long id, Long coursId, Long etudiantId, String status,
                                  Instant requestedAt, Instant decidedAt) {
        this.id = id;
        this.coursId = coursId;
        this.etudiantId = etudiantId;
        this.status = status;
        this.source = "LIBRE";
        this.requestedAt = requestedAt;
        this.decidedAt = decidedAt;
    }

    public InscriptionResponseDTO(Long id, Long coursId, Long etudiantId, String status,
                                  String source, Long groupeId, Instant requestedAt, Instant decidedAt) {
        this.id = id;
        this.coursId = coursId;
        this.etudiantId = etudiantId;
        this.status = status;
        this.source = source;
        this.groupeId = groupeId;
        this.requestedAt = requestedAt;
        this.decidedAt = decidedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public Long getEtudiantId() {
        return etudiantId;
    }

    public void setEtudiantId(Long etudiantId) {
        this.etudiantId = etudiantId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Long getGroupeId() {
        return groupeId;
    }

    public void setGroupeId(Long groupeId) {
        this.groupeId = groupeId;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(Instant requestedAt) {
        this.requestedAt = requestedAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(Instant decidedAt) {
        this.decidedAt = decidedAt;
    }
}
