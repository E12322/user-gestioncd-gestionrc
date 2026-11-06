package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Étudiant membre d'une classe (groupe) : référence vers le micro-service Utilisateur
 * + nom conservé en local pour l'affichage (pas de jointure inter-services ici).
 */
@Entity
@Getter
@Setter
@AllArgsConstructor
@ToString
@NoArgsConstructor
@Table(
        name = "groupe_etudiants",
        uniqueConstraints = @UniqueConstraint(name = "uk_etudiant_groupe", columnNames = {"groupe_id", "etudiant_id"})
)
public class EtudiantGroupe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Identifiant de l'étudiant dans le micro-service Utilisateur. */
    @Column(name = "etudiant_id", nullable = false)
    private Long etudiantId;

    /** Nom complet de l'étudiant (conservé pour l'affichage). */
    @Column(nullable = false, length = 150)
    private String nom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "groupe_id")
    @ToString.Exclude
    private Groupe groupe;
}
