package tn.esprit.gestionetudiant.dto;

import java.util.ArrayList;
import java.util.List;

public class EmploiDuTempsDTO {
    private Long id;
    private String titre;
    private String semestre;
    private List<CoursDTO> cours = new ArrayList<>();

    public EmploiDuTempsDTO() {
    }

    public EmploiDuTempsDTO(Long id, String titre, String semestre, List<CoursDTO> cours) {
        this.id = id;
        this.titre = titre;
        this.semestre = semestre;
        this.cours = (cours != null) ? cours : new ArrayList<>();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitre() {
        return titre;
    }

    public void setTitre(String titre) {
        this.titre = titre;
    }

    public String getSemestre() {
        return semestre;
    }

    public void setSemestre(String semestre) {
        this.semestre = semestre;
    }

    public List<CoursDTO> getCours() {
        return cours;
    }

    public void setCours(List<CoursDTO> cours) {
        this.cours = (cours != null) ? cours : new ArrayList<>();
    }
}
