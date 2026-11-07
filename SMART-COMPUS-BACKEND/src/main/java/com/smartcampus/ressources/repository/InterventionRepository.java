package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.Intervention;
import com.smartcampus.ressources.enums.StatutIntervention;
import com.smartcampus.ressources.enums.TypeIntervention;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InterventionRepository extends JpaRepository<Intervention, Long> {
    List<Intervention> findByStatut(StatutIntervention statut);
    List<Intervention> findByTechnicienId(Long technicienId);
    List<Intervention> findByEquipementId(Long equipementId);
    List<Intervention> findByTypeInterventionAndStatut(TypeIntervention type, StatutIntervention statut);
    List<Intervention> findByDatePlanifieeBeforeAndStatut(LocalDateTime date, StatutIntervention statut);
}
