package tn.esprit.gestionetudiant.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@AllArgsConstructor
@ToString
@NoArgsConstructor
@Table(name = "cours")
public class Cours {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 50)
    private String code;

    @Column(nullable = false, length = 255)
    private String intitule;

    @Column(length = 100)
    private String departement;

    private Integer credits;

    @Column(length = 20)
    private String semestre;

    @Column(name = "enseignant_id")
    private Long enseignantId;

    @Column(name = "enseignant_nom", length = 150)
    private String enseignantNom;

    private Integer capacite;

    /** Nature du cours : OBLIGATOIRE (affecté par groupe) ou OPTIONNEL (inscription libre). */
    @Column(name = "nature", length = 20)
    private String nature = "OBLIGATOIRE";

    @Column(length = 4000)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String contenu;

    // --- Support Vidéo Indépendant ---
    @Column(name = "video_titre", length = 255)
    private String videoTitre;

    @Column(name = "video_url", length = 2000)
    private String videoUrl;

    @Column(name = "video_nom_fichier", length = 255)
    private String videoNomFichier;

    @Column(name = "video_taille", length = 50)
    private String videoTaille;

    @Column(name = "video_format", length = 20)
    private String videoFormat;

    // --- Support Document PDF Indépendant ---
    @Column(name = "document_titre", length = 255)
    private String documentTitre;

    @Column(name = "document_url", length = 2000)
    private String documentUrl;

    @Column(name = "document_nom_fichier", length = 255)
    private String documentNomFichier;

    @Column(name = "document_taille", length = 50)
    private String documentTaille;

    @Column(name = "document_format", length = 20)
    private String documentFormat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "emploi_du_temps_id")
    private EmploiDuTemps emploiDuTemps;

    /** Supports pédogogiques du cours (PDF, PPTX, DOCX, ZIP, vidéo...) — remplacés en bloc à chaque mise à jour. */
    @OneToMany(mappedBy = "cours", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, orphanRemoval = true)
    @JsonIgnore
    private List<DocumentCours> documents = new ArrayList<>();

    @OneToMany(mappedBy = "cours", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Note> notes = new ArrayList<>();

    @OneToMany(mappedBy = "cours", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Absence> absences = new ArrayList<>();
}
