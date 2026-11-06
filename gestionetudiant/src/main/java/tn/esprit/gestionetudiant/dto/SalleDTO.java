package tn.esprit.gestionetudiant.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

public class SalleDTO {

    private Long id;

    @NotBlank(message = "Le nom de la salle est requis")
    @Size(max = 100, message = "Le nom ne doit pas dépasser 100 caractères")
    private String nom;

    @Size(max = 100, message = "Le bâtiment ne doit pas dépasser 100 caractères")
    private String batiment;

    @NotNull(message = "La capacité est requise")
    @Min(value = 1, message = "La capacité minimale est 1")
    @Max(value = 10_000, message = "La capacité maximale est 10 000")
    private Integer capacite;

    public SalleDTO() {
    }

    public SalleDTO(Long id, String nom, String batiment, Integer capacite) {
        this.id = id;
        this.nom = nom;
        this.batiment = batiment;
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

    public String getBatiment() {
        return batiment;
    }

    public void setBatiment(String batiment) {
        this.batiment = batiment;
    }

    public Integer getCapacite() {
        return capacite;
    }

    public void setCapacite(Integer capacite) {
        this.capacite = capacite;
    }
}
