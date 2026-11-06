package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.AnneeAcademique;

import java.util.Optional;

@Repository
public interface AnneeAcademiqueRepository extends JpaRepository<AnneeAcademique, Long> {

    boolean existsByLibelleIgnoreCase(String libelle);

    boolean existsByLibelleIgnoreCaseAndIdNot(String libelle, Long id);

    Optional<AnneeAcademique> findFirstByActiveTrue();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AnneeAcademique a set a.active = false where a.active = true")
    int deactivateAll();
}
