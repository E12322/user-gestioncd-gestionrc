package tn.esprit.gestionetudiant.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import tn.esprit.gestionetudiant.entity.TypeSeance;

/** Cours affecté à une classe (type de séance CM/TD/TP inclus). */
public class AffectationDTO {

    @JsonAlias({"courseId"})
    private Long coursId;

    @JsonAlias({"courseCode"})
    private String coursCode;

    private String coursIntitule;

    @JsonAlias({"teacherName"})
    private String enseignantNom;

    @JsonAlias({"type"})
    private TypeSeance type;

    public AffectationDTO() {
    }

    public AffectationDTO(Long coursId, TypeSeance type) {
        this.coursId = coursId;
        this.type = type;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public String getCoursCode() {
        return coursCode;
    }

    public void setCoursCode(String coursCode) {
        this.coursCode = coursCode;
    }

    public String getCoursIntitule() {
        return coursIntitule;
    }

    public void setCoursIntitule(String coursIntitule) {
        this.coursIntitule = coursIntitule;
    }

    public String getEnseignantNom() {
        return enseignantNom;
    }

    public void setEnseignantNom(String enseignantNom) {
        this.enseignantNom = enseignantNom;
    }

    public TypeSeance getType() {
        return type;
    }

    public void setType(TypeSeance type) {
        this.type = type;
    }
}
