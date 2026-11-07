package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.Ressource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RessourceRepository extends JpaRepository<Ressource, Long> {
    Optional<Ressource> findByNumero(String numero);
    boolean existsByNumero(String numero);
}
