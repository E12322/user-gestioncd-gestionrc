package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Salle de cours / TD / TP utilisée par les séances de l'emploi du temps.
 */
@Entity
@Table(
        name = "salles",
        uniqueConstraints = @UniqueConstraint(name = "uk_salle_nom", columnNames = "nom")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Salle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nom;

    @Column(length = 100)
    private String batiment;

    @Column(nullable = false)
    private Integer capacite;
}
