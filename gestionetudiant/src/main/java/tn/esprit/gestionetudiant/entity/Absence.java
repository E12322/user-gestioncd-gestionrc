package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
@Entity
@Getter
@Setter
@AllArgsConstructor
@ToString
@NoArgsConstructor

public class Absence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String seance;

    private LocalDate dateAbsence;

    private boolean justifiee;

    // Référence vers le microservice Utilisateur (étudiant)
    @Column(name = "etudiant_id", nullable = false)
    private Long etudiantId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cours_id", nullable = false)
    private Cours cours;

}
