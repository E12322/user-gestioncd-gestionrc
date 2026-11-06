package tn.esprit.gestionetudiant.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Support pédagogique d'un cours (PDF, PPTX, DOCX, ZIP, vidéo...).
 * Champ `taille` sous forme lisible (ex. « 4,43 Mo »).
 */
public class DocumentDTO {

    private Long id;

    @JsonAlias({"title", "titre"})
    private String titre;

    @JsonAlias({"url"})
    private String url;

    @JsonAlias({"fileName", "nomFichier"})
    private String nomFichier;

    @JsonAlias({"fileSize", "taille"})
    private String taille;

    @JsonAlias({"format", "type"})
    private String format;

    public DocumentDTO() {
    }

    public DocumentDTO(Long id, String titre, String url, String nomFichier, String taille, String format) {
        this.id = id;
        this.titre = titre;
        this.url = url;
        this.nomFichier = nomFichier;
        this.taille = taille;
        this.format = format;
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

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getNomFichier() {
        return nomFichier;
    }

    public void setNomFichier(String nomFichier) {
        this.nomFichier = nomFichier;
    }

    public String getTaille() {
        return taille;
    }

    public void setTaille(String taille) {
        this.taille = taille;
    }

    public String getFormat() {
        return format;
    }

    public void setFormat(String format) {
        this.format = format;
    }
}
