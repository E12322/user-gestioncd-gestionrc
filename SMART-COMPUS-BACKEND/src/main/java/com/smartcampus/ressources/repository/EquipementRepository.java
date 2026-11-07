package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.Equipement;
import com.smartcampus.ressources.enums.StatutEquipement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipementRepository extends JpaRepository<Equipement, Long> {
    Optional<Equipement> findByIdEquipement(String idEquipement);
    boolean existsByIdEquipement(String idEquipement);
    List<Equipement> findByStatut(StatutEquipement statut);
    List<Equipement> findBySalleId(Long salleId);
    List<Equipement> findByServiceAffecte(String serviceAffecte);
}
