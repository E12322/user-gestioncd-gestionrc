package tn.esprit.gestionetudiant.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Étudiant membre d'une classe (groupe). */
public class EtudiantDTO {

    @JsonAlias({"id", "etudiantId"})
    private Long etudiantId;

    @JsonAlias({"name", "nom"})
    private String nom;

    public EtudiantDTO() {
    }

    public EtudiantDTO(Long etudiantId, String nom) {
        this.etudiantId = etudiantId;
        this.nom = nom;
    }

    public Long getEtudiantId() {
        return etudiantId;
    }

    public void setEtudiantId(Long etudiantId) {
        this.etudiantId = etudiantId;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }
}
