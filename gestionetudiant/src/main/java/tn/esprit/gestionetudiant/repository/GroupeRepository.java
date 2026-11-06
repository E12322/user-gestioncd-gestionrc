package tn.esprit.gestionetudiant.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Groupe;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupeRepository extends JpaRepository<Groupe, Long> {

    boolean existsByCoursIdAndNomIgnoreCase(Long coursId, String nom);

    boolean existsByCoursIdAndNomIgnoreCaseAndIdNot(Long coursId, String nom, Long id);

    boolean existsByNomIgnoreCase(String nom);

    boolean existsByNomIgnoreCaseAndIdNot(String nom, Long id);

    Page<Groupe> findByCoursId(Long coursId, Pageable pageable);

    boolean existsByEtudiants_EtudiantId(Long etudiantId);

    /** Chargement groupé des membres et du cours principal (anti N+1 au mapping DTO). */
    @Query("""
            select distinct g from Groupe g
            left join fetch g.cours
            left join fetch g.etudiants
            """)
    List<Groupe> findAllWithEtudiants();

    @Query("""
            select distinct g from Groupe g
            left join fetch g.cours
            left join fetch g.etudiants
            where g.id = :id
            """)
    Optional<Groupe> findByIdWithEtudiants(@Param("id") Long id);
}
