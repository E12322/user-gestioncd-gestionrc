package tn.esprit.gestionetudiant.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Seance;

import java.time.LocalTime;
import java.util.List;

@Repository
public interface SeanceRepository extends JpaRepository<Seance, Long> {

    boolean existsBySalleId(Long salleId);

    boolean existsByGroupeId(Long groupeId);

    List<Seance> findByCoursId(Long coursId);

    List<Seance> findByCoursIdIn(List<Long> coursIds);

    /**
     * Séances qui chevauchent [heureDebut, heureFin[ le même jour, sur la salle,
     * l'enseignant ou le groupe donnés. Les identifiants non concernés sont passés
     * à -1 (aucune correspondance possible) afin d'éviter les NULL en JPQL.
     */
    @Query("""
            select s from Seance s
            where s.jour = :jour
              and s.heureDebut < :heureFin
              and s.heureFin > :heureDebut
              and s.id <> :excludeId
              and (
                    s.salle.id = :salleId
                 or s.enseignantId = :enseignantId
                 or (s.groupe is not null and s.groupe.id = :groupeId)
              )
            """)
    List<Seance> findConflicting(
            @Param("jour") Integer jour,
            @Param("heureDebut") LocalTime heureDebut,
            @Param("heureFin") LocalTime heureFin,
            @Param("salleId") Long salleId,
            @Param("enseignantId") long enseignantId,
            @Param("groupeId") long groupeId,
            @Param("excludeId") long excludeId);

    /**
     * Recherche paginée avec filtres optionnels, chargement des associations
     * (join fetch) pour éviter les N+1 lors du mapping DTO.
     */
    @Query(value = """
            select s from Seance s
            join fetch s.cours c
            join fetch s.salle r
            left join fetch s.groupe g
            where (:coursId is null or c.id = :coursId)
              and (:salleId is null or r.id = :salleId)
              and (:groupeId is null or g.id = :groupeId)
              and (:enseignantId is null or s.enseignantId = :enseignantId)
              and (:jour is null or s.jour = :jour)
            """,
            countQuery = """
            select count(s) from Seance s
            where (:coursId is null or s.cours.id = :coursId)
              and (:salleId is null or s.salle.id = :salleId)
              and (:groupeId is null or s.groupe.id = :groupeId)
              and (:enseignantId is null or s.enseignantId = :enseignantId)
              and (:jour is null or s.jour = :jour)
            """)
    Page<Seance> search(
            @Param("coursId") Long coursId,
            @Param("salleId") Long salleId,
            @Param("groupeId") Long groupeId,
            @Param("enseignantId") Long enseignantId,
            @Param("jour") Integer jour,
            Pageable pageable);
}
