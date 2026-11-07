package com.smartcampus.ressources.entity;

import com.smartcampus.ressources.enums.*;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "interventions")
public class Intervention {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_intervention", nullable = false)
    private TypeIntervention typeIntervention;

    @Column(nullable = false)
    private String description;

    @Column(name = "cout_estime")
    private Float coutEstime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutIntervention statut = StatutIntervention.PLANIFIEE;

    @Column(name = "technicien_id")
    private Long technicienId;

    @Column(name = "technicien_nom")
    private String technicienNom;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "equipement_id", nullable = false)
    private Equipement equipement;

    @Column(name = "auteur_signalement_id")
    private Long auteurSignalementId;

    @Column(name = "auteur_signalement_nom")
    private String auteurSignalementNom;

    @Column(name = "rapport_technique")
    private String rapportTechnique;

    @Column(name = "date_signalement", updatable = false)
    private LocalDateTime dateSignalement = LocalDateTime.now();

    @Column(name = "date_planifiee")
    private LocalDateTime datePlanifiee;

    @Column(name = "date_debut_traitement")
    private LocalDateTime dateDebutTraitement;

    @Column(name = "date_cloture")
    private LocalDateTime dateCloture;

    public Intervention() {
    }

    public Intervention(TypeIntervention typeIntervention, String description, Float coutEstime,
                        Equipement equipement, Long auteurSignalementId, String auteurSignalementNom,
                        LocalDateTime datePlanifiee) {
        this.typeIntervention = typeIntervention;
        this.description = description;
        this.coutEstime = coutEstime;
        this.equipement = equipement;
        this.auteurSignalementId = auteurSignalementId;
        this.auteurSignalementNom = auteurSignalementNom;
        this.datePlanifiee = datePlanifiee;
        this.statut = StatutIntervention.PLANIFIEE;
        this.dateSignalement = LocalDateTime.now();
    }

    public void planifierIntervention() {
        this.statut = StatutIntervention.PLANIFIEE;
        if (this.equipement != null) {
            if (this.typeIntervention == TypeIntervention.CORRECTIVE) {
                this.equipement.declarerPanne();
            } else {
                this.equipement.passerEnMaintenance();
            }
        }
    }

    public void demarrerTraitement(Long technicienId, String technicienNom) {
        this.statut = StatutIntervention.EN_COURS;
        this.technicienId = technicienId;
        this.technicienNom = technicienNom;
        this.dateDebutTraitement = LocalDateTime.now();
        if (this.equipement != null) {
            this.equipement.passerEnMaintenance();
        }
    }

    public void cloturerIntervention(String rapportTechnique) {
        this.statut = StatutIntervention.CLOTUREE;
        this.rapportTechnique = rapportTechnique;
        this.dateCloture = LocalDateTime.now();
        if (this.equipement != null) {
            this.equipement.mettreEnService();
            this.equipement.setDateDerniereMaintenance(java.time.LocalDate.now());
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TypeIntervention getTypeIntervention() {
        return typeIntervention;
    }

    public void setTypeIntervention(TypeIntervention typeIntervention) {
        this.typeIntervention = typeIntervention;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Float getCoutEstime() {
        return coutEstime;
    }

    public void setCoutEstime(Float coutEstime) {
        this.coutEstime = coutEstime;
    }

    public StatutIntervention getStatut() {
        return statut;
    }

    public void setStatut(StatutIntervention statut) {
        this.statut = statut;
    }

    public Long getTechnicienId() {
        return technicienId;
    }

    public void setTechnicienId(Long technicienId) {
        this.technicienId = technicienId;
    }

    public String getTechnicienNom() {
        return technicienNom;
    }

    public void setTechnicienNom(String technicienNom) {
        this.technicienNom = technicienNom;
    }

    public Equipement getEquipement() {
        return equipement;
    }

    public void setEquipement(Equipement equipement) {
        this.equipement = equipement;
    }

    public Long getAuteurSignalementId() {
        return auteurSignalementId;
    }

    public void setAuteurSignalementId(Long auteurSignalementId) {
        this.auteurSignalementId = auteurSignalementId;
    }

    public String getAuteurSignalementNom() {
        return auteurSignalementNom;
    }

    public void setAuteurSignalementNom(String auteurSignalementNom) {
        this.auteurSignalementNom = auteurSignalementNom;
    }

    public String getRapportTechnique() {
        return rapportTechnique;
    }

    public void setRapportTechnique(String rapportTechnique) {
        this.rapportTechnique = rapportTechnique;
    }

    public LocalDateTime getDateSignalement() {
        return dateSignalement;
    }

    public void setDateSignalement(LocalDateTime dateSignalement) {
        this.dateSignalement = dateSignalement;
    }

    public LocalDateTime getDatePlanifiee() {
        return datePlanifiee;
    }

    public void setDatePlanifiee(LocalDateTime datePlanifiee) {
        this.datePlanifiee = datePlanifiee;
    }

    public LocalDateTime getDateDebutTraitement() {
        return dateDebutTraitement;
    }

    public void setDateDebutTraitement(LocalDateTime dateDebutTraitement) {
        this.dateDebutTraitement = dateDebutTraitement;
    }

    public LocalDateTime getDateCloture() {
        return dateCloture;
    }

    public void setDateCloture(LocalDateTime dateCloture) {
        this.dateCloture = dateCloture;
    }
}
