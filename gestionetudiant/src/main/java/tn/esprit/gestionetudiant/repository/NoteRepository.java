package tn.esprit.gestionetudiant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tn.esprit.gestionetudiant.entity.Note;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByEtudiantId(Long etudiantId);

    @Query("SELECT n FROM Note n WHERE n.cours.id = :coursId")
    List<Note> findByCoursId(@Param("coursId") Long coursId);

    @Query("SELECT n FROM Note n WHERE n.etudiantId = :etudiantId AND n.cours.id = :coursId")
    Optional<Note> findByEtudiantIdAndCoursId(@Param("etudiantId") Long etudiantId, @Param("coursId") Long coursId);

    @Query("SELECT AVG(n.valeur) FROM Note n WHERE n.etudiantId = :etudiantId")
    Double calculateMoyenneByEtudiantId(@Param("etudiantId") Long etudiantId);
}
