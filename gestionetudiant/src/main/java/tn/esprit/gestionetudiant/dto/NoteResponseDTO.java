package tn.esprit.gestionetudiant.dto;

public class NoteResponseDTO {
    private Long id;
    private float valeur;
    private Long etudiantId;
    private String etudiantNom;
    private Long coursId;
    private String coursIntitule;

    public NoteResponseDTO() {
    }

    public NoteResponseDTO(Long id, float valeur, Long etudiantId, String etudiantNom, Long coursId, String coursIntitule) {
        this.id = id;
        this.valeur = valeur;
        this.etudiantId = etudiantId;
        this.etudiantNom = etudiantNom;
        this.coursId = coursId;
        this.coursIntitule = coursIntitule;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public float getValeur() {
        return valeur;
    }

    public void setValeur(float valeur) {
        this.valeur = valeur;
    }

    public Long getEtudiantId() {
        return etudiantId;
    }

    public void setEtudiantId(Long etudiantId) {
        this.etudiantId = etudiantId;
    }

    public String getEtudiantNom() {
        return etudiantNom;
    }

    public void setEtudiantNom(String etudiantNom) {
        this.etudiantNom = etudiantNom;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public String getCoursIntitule() {
        return coursIntitule;
    }

    public void setCoursIntitule(String coursIntitule) {
        this.coursIntitule = coursIntitule;
    }
}
