package com.smartcampus.ressources.entity;

import com.smartcampus.ressources.enums.*;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "equipements")
public class Equipement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id_equipement", nullable = false, unique = true)
    private String idEquipement;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String categorie;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutEquipement statut = StatutEquipement.OPERATIONNEL;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "salle_id")
    private Salle salle;

    @Column(name = "service_affecte")
    private String serviceAffecte;

    @Column(name = "periodicite_maintenance_jours")
    private Integer periodiciteMaintenanceJours;

    @Column(name = "date_derniere_maintenance")
    private LocalDate dateDerniereMaintenance;

    public Equipement() {
    }

    public Equipement(String idEquipement, String nom, String categorie, Salle salle, String serviceAffecte, Integer periodiciteMaintenanceJours) {
        this.idEquipement = idEquipement;
        this.nom = nom;
        this.categorie = categorie;
        this.salle = salle;
        this.serviceAffecte = serviceAffecte;
        this.periodiciteMaintenanceJours = periodiciteMaintenanceJours;
        this.statut = StatutEquipement.OPERATIONNEL;
    }

    public void declarerPanne() {
        this.statut = StatutEquipement.EN_PANNE;
    }

    public void mettreEnService() {
        this.statut = StatutEquipement.OPERATIONNEL;
    }

    public void mettreHorsService() {
        this.statut = StatutEquipement.HORS_SERVICE;
    }

    public void passerEnMaintenance() {
        this.statut = StatutEquipement.EN_MAINTENANCE;
    }

    public boolean isDisponible() {
        return this.statut == StatutEquipement.OPERATIONNEL;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getIdEquipement() {
        return idEquipement;
    }

    public void setIdEquipement(String idEquipement) {
        this.idEquipement = idEquipement;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getCategorie() {
        return categorie;
    }

    public void setCategorie(String categorie) {
        this.categorie = categorie;
    }

    public StatutEquipement getStatut() {
        return statut;
    }

    public void setStatut(StatutEquipement statut) {
        this.statut = statut;
    }

    public Salle getSalle() {
        return salle;
    }

    public void setSalle(Salle salle) {
        this.salle = salle;
    }

    public String getServiceAffecte() {
        return serviceAffecte;
    }

    public void setServiceAffecte(String serviceAffecte) {
        this.serviceAffecte = serviceAffecte;
    }

    public Integer getPeriodiciteMaintenanceJours() {
        return periodiciteMaintenanceJours;
    }

    public void setPeriodiciteMaintenanceJours(Integer periodiciteMaintenanceJours) {
        this.periodiciteMaintenanceJours = periodiciteMaintenanceJours;
    }

    public LocalDate getDateDerniereMaintenance() {
        return dateDerniereMaintenance;
    }

    public void setDateDerniereMaintenance(LocalDate dateDerniereMaintenance) {
        this.dateDerniereMaintenance = dateDerniereMaintenance;
    }
}
