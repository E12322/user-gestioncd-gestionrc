package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.Salle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalleRepository extends JpaRepository<Salle, Long> {
    List<Salle> findByCapaciteGreaterThanEqualAndDisponibleTrue(int capaciteMin);
    List<Salle> findByBatiment(String batiment);
}
