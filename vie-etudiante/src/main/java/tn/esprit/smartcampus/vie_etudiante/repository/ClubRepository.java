package tn.esprit.smartcampus.vie_etudiante.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.smartcampus.vie_etudiante.model.Club;

import java.util.Optional;

@Repository
public interface ClubRepository extends MongoRepository<Club, String> {
    boolean existsByNameIgnoreCase(String name);
    Optional<Club> findByNameIgnoreCase(String name);
}
