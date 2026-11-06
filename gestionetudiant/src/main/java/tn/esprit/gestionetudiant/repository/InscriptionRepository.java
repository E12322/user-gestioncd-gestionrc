package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.esprit.gestionetudiant.entity.Inscription;

import java.util.List;
import java.util.Optional;

public interface InscriptionRepository extends JpaRepository<Inscription, Long> {

    /** Demandes (tout statut) d'un étudiant. */
    List<Inscription> findByEtudiantIdOrderByDateDemandeDesc(Long etudiantId);

    /** Demandes d'un cours (workflow administrateur). */
    List<Inscription> findByCoursIdOrderByDateDemandeDesc(Long coursId);

    /** Toutes les demandes, antéchronologiques. */
    List<Inscription> findAllByOrderByDateDemandeDesc();

    /** Demande active d'un étudiant pour un cours (refusée exclue). */
    Optional<Inscription> findByCoursIdAndEtudiantIdAndStatutNot(Long coursId, Long etudiantId, String statut);

    /** Nombre d'inscriptions validées (places occupées) pour un cours. */
    long countByCoursIdAndStatut(Long coursId, String statut);

    /** Inscription exacte d'un étudiant pour un cours (contrainte unique cours_id + etudiant_id). */
    Optional<Inscription> findByCoursIdAndEtudiantId(Long coursId, Long etudiantId);

    /** Inscriptions d'un étudiant selon le statut. */
    List<Inscription> findByEtudiantIdAndStatut(Long etudiantId, String statut);

    /** Inscriptions d'un étudiant pour un groupe et une source (GROUPE ou LIBRE). */
    List<Inscription> findByEtudiantIdAndGroupeIdAndSource(Long etudiantId, Long groupeId, String source);

    /** Inscriptions d'un cours pour un groupe et une source (GROUPE ou LIBRE). */
    List<Inscription> findByCoursIdAndGroupeIdAndSource(Long coursId, Long groupeId, String source);

    /** Inscriptions d'un groupe selon la source. */
    List<Inscription> findByGroupeIdAndSource(Long groupeId, String source);

    /** Suppression des inscriptions de source GROUPE pour un cours et un groupe. */
    void deleteByCoursIdAndGroupeIdAndSource(Long coursId, Long groupeId, String source);

    /** Suppression des inscriptions de source GROUPE pour un étudiant et un groupe. */
    void deleteByEtudiantIdAndGroupeIdAndSource(Long etudiantId, Long groupeId, String source);
}
