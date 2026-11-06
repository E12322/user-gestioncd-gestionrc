package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Cours;

import java.util.List;
import java.util.Optional;

@Repository
public interface CoursRepository extends JpaRepository<Cours, Long> {
    List<Cours> findByEnseignantId(Long enseignantId);
    List<Cours> findByEmploiDuTempsId(Long emploiDuTempsId);

    /** Chargement groupé des supports pédagogiques pour éviter les N+1 au mapping DTO. */
    @Query("""
            select distinct c from Cours c
            left join fetch c.documents
            """)
    List<Cours> findAllWithDocuments();

    @Query("""
            select distinct c from Cours c
            left join fetch c.documents
            where c.id = :id
            """)
    Optional<Cours> findByIdWithDocuments(@Param("id") Long id);
}
