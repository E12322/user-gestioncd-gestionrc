package com.smartcampus.ressources.entity;

import com.smartcampus.ressources.enums.*;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "reservations")
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "ressource_id", nullable = false)
    private Ressource ressource;

    @Column(name = "date_debut", nullable = false)
    private LocalDateTime dateDebut;

    @Column(name = "date_fin", nullable = false)
    private LocalDateTime dateFin;

    @Column(nullable = false)
    private String motif;

    @Column(name = "nb_participants", nullable = false)
    private int nombreParticipants;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutReservation statut = StatutReservation.DEMANDEE;

    @Column(name = "demandeur_id", nullable = false)
    private Long demandeurId;

    @Column(name = "demandeur_nom", nullable = false)
    private String demandeurNom;

    @Column(name = "demandeur_email")
    private String demandeurEmail;

    @Column(name = "demandeur_role")
    private String demandeurRole;

    @Column(name = "valideur_id")
    private Long valideurId;

    @Column(name = "motif_refus")
    private String motifRefus;

    @Column(name = "date_demande", updatable = false)
    private LocalDateTime dateDemande = LocalDateTime.now();

    @Column(name = "date_decision")
    private LocalDateTime dateDecision;

    public Reservation() {
    }

    public Reservation(Ressource ressource, LocalDateTime dateDebut, LocalDateTime dateFin,
                       String motif, int nombreParticipants, Long demandeurId,
                       String demandeurNom, String demandeurEmail, String demandeurRole) {
        this.ressource = ressource;
        this.dateDebut = dateDebut;
        this.dateFin = dateFin;
        this.motif = motif;
        this.nombreParticipants = nombreParticipants;
        this.demandeurId = demandeurId;
        this.demandeurNom = demandeurNom;
        this.demandeurEmail = demandeurEmail;
        this.demandeurRole = demandeurRole;
        this.statut = StatutReservation.DEMANDEE;
        this.dateDemande = LocalDateTime.now();
    }

    public void creerReservation() {
        this.statut = StatutReservation.DEMANDEE;
    }

    public void annulerReservation() {
        this.statut = StatutReservation.ANNULEE;
        this.dateDecision = LocalDateTime.now();
    }

    public void valider(Long responsableId) {
        this.statut = StatutReservation.VALIDEE;
        this.valideurId = responsableId;
        this.dateDecision = LocalDateTime.now();
    }

    public void refuser(Long responsableId, String motifRefus) {
        this.statut = StatutReservation.REFUSEE;
        this.valideurId = responsableId;
        this.motifRefus = motifRefus;
        this.dateDecision = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Ressource getRessource() {
        return ressource;
    }

    public void setRessource(Ressource ressource) {
        this.ressource = ressource;
    }

    public LocalDateTime getDateDebut() {
        return dateDebut;
    }

    public void setDateDebut(LocalDateTime dateDebut) {
        this.dateDebut = dateDebut;
    }

    public LocalDateTime getDateFin() {
        return dateFin;
    }

    public void setDateFin(LocalDateTime dateFin) {
        this.dateFin = dateFin;
    }

    public String getMotif() {
        return motif;
    }

    public void setMotif(String motif) {
        this.motif = motif;
    }

    public int getNombreParticipants() {
        return nombreParticipants;
    }

    public void setNombreParticipants(int nombreParticipants) {
        this.nombreParticipants = nombreParticipants;
    }

    public StatutReservation getStatut() {
        return statut;
    }

    public void setStatut(StatutReservation statut) {
        this.statut = statut;
    }

    public Long getDemandeurId() {
        return demandeurId;
    }

    public void setDemandeurId(Long demandeurId) {
        this.demandeurId = demandeurId;
    }

    public String getDemandeurNom() {
        return demandeurNom;
    }

    public void setDemandeurNom(String demandeurNom) {
        this.demandeurNom = demandeurNom;
    }

    public String getDemandeurEmail() {
        return demandeurEmail;
    }

    public void setDemandeurEmail(String demandeurEmail) {
        this.demandeurEmail = demandeurEmail;
    }

    public String getDemandeurRole() {
        return demandeurRole;
    }

    public void setDemandeurRole(String demandeurRole) {
        this.demandeurRole = demandeurRole;
    }

    public Long getValideurId() {
        return valideurId;
    }

    public void setValideurId(Long valideurId) {
        this.valideurId = valideurId;
    }

    public String getMotifRefus() {
        return motifRefus;
    }

    public void setMotifRefus(String motifRefus) {
        this.motifRefus = motifRefus;
    }

    public LocalDateTime getDateDemande() {
        return dateDemande;
    }

    public void setDateDemande(LocalDateTime dateDemande) {
        this.dateDemande = dateDemande;
    }

    public LocalDateTime getDateDecision() {
        return dateDecision;
    }

    public void setDateDecision(LocalDateTime dateDecision) {
        this.dateDecision = dateDecision;
    }
}
