package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalTime;

/**
 * Créneau de l'emploi du temps : un cours, un jour, une plage horaire,
 * une salle, éventuellement un groupe et un enseignant.
 *
 * Le jour est codé 1 = lundi ... 6 = samedi (convention reprise par le front).
 */
@Entity
@Table(
        name = "seances",
        indexes = {
                @Index(name = "idx_seance_jour_horaire", columnList = "jour,heure_debut,heure_fin"),
                @Index(name = "idx_seance_salle", columnList = "salle_id"),
                @Index(name = "idx_seance_enseignant", columnList = "enseignant_id"),
                @Index(name = "idx_seance_groupe", columnList = "groupe_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Seance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cours_id", nullable = false)
    private Cours cours;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "salle_id", nullable = false)
    private Salle salle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id")
    private Groupe groupe;

    @Column(name = "enseignant_id")
    private Long enseignantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TypeSeance type;

    @Column(nullable = false)
    private Integer jour;

    @Column(name = "heure_debut", nullable = false)
    private LocalTime heureDebut;

    @Column(name = "heure_fin", nullable = false)
    private LocalTime heureFin;
}
