package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Année universitaire (ex. "2025-2026"). Une seule année peut être active à la fois.
 */
@Entity
@Table(
        name = "annees_academiques",
        uniqueConstraints = @UniqueConstraint(name = "uk_annee_academique_libelle", columnNames = "libelle")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AnneeAcademique {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String libelle;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin", nullable = false)
    private LocalDate dateFin;

    @Column(nullable = false)
    private boolean active = false;
}
