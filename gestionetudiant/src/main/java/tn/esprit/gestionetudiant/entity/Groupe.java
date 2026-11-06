package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.ToString;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * Classe (groupe) d'étudiants rattachée à un cours. Sert à planifier les séances
 * de son emploi du temps et à détecter les conflits.
 */
@Entity
@Table(name = "groupes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Groupe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TypeSeance type;

    @Column(nullable = false)
    private Integer capacite;

    /** Étudiants membres de la classe (l'effectif ne peut pas dépasser la capacité). */
    @OneToMany(mappedBy = "groupe", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, orphanRemoval = true)
    private List<EtudiantGroupe> etudiants = new ArrayList<>();

    /** Cours suivis par la classe (affectation N..N, ajout/retrait via le service). */
    @OneToMany(mappedBy = "groupe", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    private List<AffectationCours> affectations = new ArrayList<>();

    /** Cours principal (optionnel : le rattachement se fait via AffectationCours). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cours_id")
    private Cours cours;
}
