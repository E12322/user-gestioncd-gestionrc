package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Absence;

import java.util.List;

@Repository
public interface AbsenceRepository extends JpaRepository<Absence, Long> {
    List<Absence> findByEtudiantId(Long etudiantId);

    @Query("SELECT a FROM Absence a WHERE a.cours.id = :coursId")
    List<Absence> findByCoursId(@Param("coursId") Long coursId);

    @Query("SELECT a FROM Absence a WHERE a.etudiantId = :etudiantId AND a.cours.id = :coursId")
    List<Absence> findByEtudiantIdAndCoursId(@Param("etudiantId") Long etudiantId, @Param("coursId") Long coursId);

    @Query("SELECT CASE WHEN COUNT(a) > 0 THEN true ELSE false END FROM Absence a WHERE a.etudiantId = :etudiantId AND a.cours.id = :coursId AND LOWER(a.seance) = LOWER(:seance)")
    boolean existsByEtudiantIdAndCoursIdAndSeance(@Param("etudiantId") Long etudiantId, @Param("coursId") Long coursId, @Param("seance") String seance);

    @Query("SELECT COUNT(a) FROM Absence a WHERE a.etudiantId = :etudiantId AND a.cours.id = :coursId")
    long countByEtudiantIdAndCoursId(@Param("etudiantId") Long etudiantId, @Param("coursId") Long coursId);
}
