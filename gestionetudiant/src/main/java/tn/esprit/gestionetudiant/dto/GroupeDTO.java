package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import tn.esprit.gestionetudiant.entity.TypeSeance;

import java.util.List;

public class GroupeDTO {

    private Long id;

    @NotBlank(message = "Le nom du groupe est requis")
    @Size(max = 50, message = "Le nom ne doit pas dépasser 50 caractères")
    private String nom;

    @NotNull(message = "Le type du groupe est requis (CM, TD ou TP)")
    private TypeSeance type;

    /** ID du cours principal (optionnel, les cours sont gérés via AffectationCours). */
    private Long coursId;

    @NotNull(message = "La capacité est requise")
    @Min(value = 1, message = "La capacité minimale est 1")
    private Integer capacite;

    // Champs dérivés (lecture seule)
    private String coursCode;
    private String coursIntitule;

    /** Effectif actuel de la classe (lecture seule). */
    private Integer effectif;

    /** Étudiants membres de la classe (lecture seule ; ajout/retrait via /etudiants). */
    @JsonAlias({"students", "etudiants"})
    private List<EtudiantDTO> etudiants;

    /** Cours affectés à la classe (lecture seule ; ajout/retrait via /cours). */
    @JsonAlias({"affectations", "affectedCourses"})
    private List<AffectationDTO> affectations;

    public GroupeDTO() {
    }

    public GroupeDTO(Long id, String nom, TypeSeance type, Long coursId, Integer capacite) {
        this.id = id;
        this.nom = nom;
        this.type = type;
        this.coursId = coursId;
        this.capacite = capacite;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public TypeSeance getType() {
        return type;
    }

    public void setType(TypeSeance type) {
        this.type = type;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public Integer getCapacite() {
        return capacite;
    }

    public void setCapacite(Integer capacite) {
        this.capacite = capacite;
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

    public Integer getEffectif() {
        return effectif;
    }

    public void setEffectif(Integer effectif) {
        this.effectif = effectif;
    }

    public List<EtudiantDTO> getEtudiants() {
        return etudiants;
    }

    public void setEtudiants(List<EtudiantDTO> etudiants) {
        this.etudiants = etudiants;
    }

    public List<AffectationDTO> getAffectations() {
        return affectations;
    }

    public void setAffectations(List<AffectationDTO> affectations) {
        this.affectations = affectations;
    }
}
