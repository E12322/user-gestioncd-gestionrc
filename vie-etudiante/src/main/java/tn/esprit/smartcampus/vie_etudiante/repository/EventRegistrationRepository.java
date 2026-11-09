package tn.esprit.smartcampus.vie_etudiante.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.smartcampus.vie_etudiante.model.EventRegistration;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventRegistrationRepository extends MongoRepository<EventRegistration, String> {
    List<EventRegistration> findByEventId(String eventId);
    List<EventRegistration> findByStudentId(String studentId);
    Optional<EventRegistration> findByEventIdAndStudentId(String eventId, String studentId);
    void deleteByEventId(String eventId);
    long countByEventId(String eventId);
}
