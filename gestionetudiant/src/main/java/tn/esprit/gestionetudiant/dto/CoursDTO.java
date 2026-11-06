package tn.esprit.gestionetudiant.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class CoursDTO {

    private Long id;

    @Size(max = 50, message = "Le code ne doit pas dépasser 50 caractères")
    private String code;

    @JsonAlias({"title", "titre"})
    @NotBlank(message = "L'intitulé du cours est requis")
    @Size(max = 255, message = "L'intitulé ne doit pas dépasser 255 caractères")
    private String intitule;

    @JsonAlias({"department"})
    @Size(max = 100, message = "Le département ne doit pas dépasser 100 caractères")
    private String departement;

    @Min(value = 0, message = "Le nombre de crédits doit être positif")
    @Max(value = 60, message = "Le nombre de crédits ne peut pas dépasser 60")
    private Integer credits;

    @JsonAlias({"semester"})
    @Size(max = 20, message = "Le semestre ne doit pas dépasser 20 caractères")
    private String semestre;

    @JsonAlias({"teacherId"})
    private Long enseignantId;

    @JsonAlias({"teacherName"})
    @Size(max = 150, message = "Le nom de l'enseignant ne doit pas dépasser 150 caractères")
    private String enseignantNom;

    @JsonAlias({"capacity"})
    @Min(value = 1, message = "La capacité minimale est 1")
    private Integer capacite;

    /** OBLIGATOIRE | OPTIONNEL */
    @JsonAlias({"type", "nature"})
    private String nature = "OBLIGATOIRE";

    private String description;

    @JsonAlias({"content"})
    private String contenu;

    // --- Support Vidéo ---
    @JsonAlias({"videoTitle"})
    private String videoTitre;

    private String videoUrl;

    @JsonAlias({"videoFileName"})
    private String videoNomFichier;

    @JsonAlias({"videoFileSize"})
    private String videoTaille;

    private String videoFormat;

    // --- Support Document PDF ---
    @JsonAlias({"documentTitle"})
    private String documentTitre;

    private String documentUrl;

    @JsonAlias({"documentFileName"})
    private String documentNomFichier;

    @JsonAlias({"documentFileSize"})
    private String documentTaille;

    private String documentFormat;

    private Long emploiDuTempsId;

    /** Supports pédagogiques du cours (PDF, PPTX, DOCX, ZIP, vidéo...). */
    @JsonAlias({"documents", "supports"})
    private List<DocumentDTO> documents;

    // Constructeur de rétrocompatibilité
    public CoursDTO(Long id, String intitule, Long enseignantId, String enseignantNom, Long emploiDuTempsId) {
        this.id = id;
        this.intitule = intitule;
        this.enseignantId = enseignantId;
        this.enseignantNom = enseignantNom;
        this.emploiDuTempsId = emploiDuTempsId;
    }
}
