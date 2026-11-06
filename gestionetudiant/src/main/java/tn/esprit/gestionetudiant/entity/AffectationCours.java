package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Affectation d'un cours à une classe : une classe peut suivre plusieurs cours,
 * chacun avec un type de séance (Cours magistral, TD ou TP) — comme la fiche
 * « Cours affectés » de la démo.
 */
@Entity
@AllArgsConstructor
@ToString
@NoArgsConstructor
@Table(
        name = "affectations_cours",
        uniqueConstraints = @UniqueConstraint(name = "uk_affectation_groupe_cours", columnNames = {"groupe_id", "cours_id"})
)
@Getter
@Setter
public class AffectationCours {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Type de séance suivi par cette classe pour ce cours (CM, TD ou TP). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TypeSeance type;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "groupe_id")
    @ToString.Exclude
    private Groupe groupe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cours_id")
    @ToString.Exclude
    private Cours cours;
}
