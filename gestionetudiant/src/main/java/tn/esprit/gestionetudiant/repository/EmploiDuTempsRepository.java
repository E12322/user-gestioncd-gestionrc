package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.EmploiDuTemps;

import java.util.List;

@Repository
public interface EmploiDuTempsRepository extends JpaRepository<EmploiDuTemps, Long> {

    @Query("SELECT DISTINCT e FROM EmploiDuTemps e JOIN e.coursList c WHERE c.enseignantId = :utilisateurId")
    List<EmploiDuTemps> findByEnseignantId(@Param("utilisateurId") Long utilisateurId);
}
