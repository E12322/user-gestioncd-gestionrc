package tn.esprit.gestionetudiant.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Inscription d'un étudiant à un cours, avec workflow administrateur :
 * {@code pending} (en attente) → {@code validated} ou {@code refused}.
 *
 * L'étudiant est référencé par son identifiant du user-service (claim "sub"
 * du JWT, ex. ETU-2026-0002 → 20260002), au même titre que les autres entités
 * académiques (Note.etudiantId, Absence.etudiantId).
 */
@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "inscriptions", uniqueConstraints = @UniqueConstraint(
        columnNames = {"cours_id", "etudiant_id"}))
public class Inscription {

    /** Statut "en attente" : demande créée, non encore traitée par l'admin. */
    public static final String STATUT_EN_ATTENTE = "pending";
    /** Décision "validée" : l'étudiant est inscrit. */
    public static final String STATUT_VALIDEE = "validated";
    /** Décision "refusée" : demande rejetée (une nouvelle demande reste possible). */
    public static final String STATUT_REFUSEE = "refused";

    /** Source d'inscription : GROUPE (créée automatiquement par affectation) ou LIBRE (choix optionnel de l'étudiant). */
    public static final String SOURCE_GROUPE = "GROUPE";
    public static final String SOURCE_LIBRE = "LIBRE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cours_id", nullable = false)
    private Long coursId;

    @Column(name = "etudiant_id", nullable = false)
    private Long etudiantId;

    /** pending | validated | refused */
    @Column(nullable = false, length = 20)
    private String statut = STATUT_EN_ATTENTE;

    /** GROUPE | LIBRE */
    @Column(name = "source", length = 20)
    private String source = SOURCE_LIBRE;

    /** ID du groupe si source == GROUPE */
    @Column(name = "groupe_id")
    private Long groupeId;

    @Column(name = "date_demande", nullable = false)
    private Instant dateDemande;

    /** Null tant que l'administrateur n'a pas tranché. */
    @Column(name = "date_decision")
    private Instant dateDecision;
}
