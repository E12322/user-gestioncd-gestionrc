package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.AffectationCours;

import java.util.List;
import java.util.Optional;

@Repository
public interface AffectationCoursRepository extends JpaRepository<AffectationCours, Long> {

    boolean existsByGroupeIdAndCoursId(Long groupeId, Long coursId);

    /** Affectations d'une classe, cours chargé (anti N+1). */
    @Query("""
            select a from AffectationCours a
            join fetch a.cours
            where a.groupe.id = :groupeId
            order by a.cours.intitule
            """)
    List<AffectationCours> findByGroupeIdWithCours(@Param("groupeId") Long groupeId);

    /** Une affectation précise d'une classe. */
    @Query("""
            select a from AffectationCours a
            join fetch a.cours
            where a.groupe.id = :groupeId and a.cours.id = :coursId
            """)
    Optional<AffectationCours> findByGroupeIdAndCoursId(@Param("groupeId") Long groupeId, @Param("coursId") Long coursId);

    /** Toutes les affectations, cours chargé (mapping des listes paginées). */
    @Query("""
            select a from AffectationCours a
            join fetch a.cours
            """)
    List<AffectationCours> findAllWithCours();
}
