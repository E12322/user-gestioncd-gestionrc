package tn.esprit.gestionetudiant.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Salle;

@Repository
public interface SalleRepository extends JpaRepository<Salle, Long> {

    boolean existsByNomIgnoreCase(String nom);

    boolean existsByNomIgnoreCaseAndIdNot(String nom, Long id);

    Page<Salle> findByNomContainingIgnoreCase(String nom, Pageable pageable);
}
