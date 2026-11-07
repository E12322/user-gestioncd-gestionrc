package com.smartcampus.ressources.entity;

import com.smartcampus.ressources.enums.*;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "salles")
public class Salle extends Ressource {

    @Column(nullable = false)
    private int capacite;

    @Column(nullable = false)
    private String batiment;

    @Column(nullable = false)
    private int etage;

    @Column(nullable = false)
    private boolean projecteur = false;

    @Column(nullable = false)
    private boolean climatisee = false;

    public Salle() {
        super();
    }

    public Salle(String numero, String nom, TypeRessource type, int capacite, String batiment, int etage, boolean projecteur, boolean climatisee) {
        super(numero, nom, type);
        this.capacite = capacite;
        this.batiment = batiment;
        this.etage = etage;
        this.projecteur = projecteur;
        this.climatisee = climatisee;
    }

    public int getCapacite() {
        return capacite;
    }

    public void setCapacite(int capacite) {
        this.capacite = capacite;
    }

    public String getBatiment() {
        return batiment;
    }

    public void setBatiment(String batiment) {
        this.batiment = batiment;
    }

    public int getEtage() {
        return etage;
    }

    public void setEtage(int etage) {
        this.etage = etage;
    }

    public boolean isProjecteur() {
        return projecteur;
    }

    public void setProjecteur(boolean projecteur) {
        this.projecteur = projecteur;
    }

    public boolean isClimatisee() {
        return climatisee;
    }

    public void setClimatisee(boolean climatisee) {
        this.climatisee = climatisee;
    }
}
