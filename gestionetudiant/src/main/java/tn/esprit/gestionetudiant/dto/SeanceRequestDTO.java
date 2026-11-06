package tn.esprit.gestionetudiant.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import tn.esprit.gestionetudiant.entity.TypeSeance;

import java.time.LocalTime;

/**
 * Requête de création / modification d'une séance de l'emploi du temps.
 */
public class SeanceRequestDTO {

    @NotNull(message = "L'ID du cours est requis")
    private Long coursId;

    /** Optionnel : séance réservée à un groupe (TD/TP). */
    private Long groupeId;

    @NotNull(message = "L'ID de la salle est requis")
    private Long salleId;

    private Long enseignantId;

    @NotNull(message = "Le type de séance est requis (CM, TD ou TP)")
    private TypeSeance type;

    /** 1 = lundi ... 6 = samedi. */
    @NotNull(message = "Le jour est requis")
    @Min(value = 1, message = "Le jour doit être compris entre 1 (lundi) et 6 (samedi)")
    @Max(value = 6, message = "Le jour doit être compris entre 1 (lundi) et 6 (samedi)")
    private Integer jour;

    @NotNull(message = "L'heure de début est requise")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime heureDebut;

    @NotNull(message = "L'heure de fin est requise")
    @JsonFormat(pattern = "HH:mm")
    private LocalTime heureFin;

    public SeanceRequestDTO() {
    }

    public SeanceRequestDTO(Long coursId, Long groupeId, Long salleId, Long enseignantId,
                            TypeSeance type, Integer jour, LocalTime heureDebut, LocalTime heureFin) {
        this.coursId = coursId;
        this.groupeId = groupeId;
        this.salleId = salleId;
        this.enseignantId = enseignantId;
        this.type = type;
        this.jour = jour;
        this.heureDebut = heureDebut;
        this.heureFin = heureFin;
    }

    public Long getCoursId() {
        return coursId;
    }

    public void setCoursId(Long coursId) {
        this.coursId = coursId;
    }

    public Long getGroupeId() {
        return groupeId;
    }

    public void setGroupeId(Long groupeId) {
        this.groupeId = groupeId;
    }

    public Long getSalleId() {
        return salleId;
    }

    public void setSalleId(Long salleId) {
        this.salleId = salleId;
    }

    public Long getEnseignantId() {
        return enseignantId;
    }

    public void setEnseignantId(Long enseignantId) {
        this.enseignantId = enseignantId;
    }

    public TypeSeance getType() {
        return type;
    }

    public void setType(TypeSeance type) {
        this.type = type;
    }

    public Integer getJour() {
        return jour;
    }

    public void setJour(Integer jour) {
        this.jour = jour;
    }

    public LocalTime getHeureDebut() {
        return heureDebut;
    }

    public void setHeureDebut(LocalTime heureDebut) {
        this.heureDebut = heureDebut;
    }

    public LocalTime getHeureFin() {
        return heureFin;
    }

    public void setHeureFin(LocalTime heureFin) {
        this.heureFin = heureFin;
    }
}
