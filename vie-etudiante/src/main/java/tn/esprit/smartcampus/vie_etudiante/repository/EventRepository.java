package tn.esprit.smartcampus.vie_etudiante.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;

import java.util.List;

@Repository
public interface EventRepository extends MongoRepository<CampusEvent, String> {
    List<CampusEvent> findByDateGreaterThanEqualOrderByDateAscStartAsc(String date);
    List<CampusEvent> findByClubIdAndDateGreaterThanEqualOrderByDateAscStartAsc(String clubId, String date);
    List<CampusEvent> findByClubId(String clubId);
    List<CampusEvent> findByClubIdAndDateBetweenOrderByDateAscStartAsc(String clubId, String startDate, String endDate);
}
