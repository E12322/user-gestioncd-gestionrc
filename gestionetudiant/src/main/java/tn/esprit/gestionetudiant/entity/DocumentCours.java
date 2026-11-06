package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@AllArgsConstructor
@ToString
@NoArgsConstructor
@Table(name = "document_cours")
public class DocumentCours {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Titre affiché au front (nom du fichier sans extension par défaut). */
    @Column(nullable = false, length = 255)
    private String titre;

    /** URL absolue du fichier servi par le backend (ex. http://localhost:8080/uploads/xxx.pdf). */
    @Column(nullable = false, length = 2000)
    private String url;

    @Column(name = "nom_fichier", length = 255)
    private String nomFichier;

    /** Taille lisible (ex. « 4,43 Mo »). */
    @Column(name = "taille", length = 50)
    private String taille;

    /** Format : PDF, PPTX, DOCX, ZIP, MP4, WEB... */
    @Column(length = 20)
    private String format;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cours_id")
    @ToString.Exclude
    private Cours cours;
}
