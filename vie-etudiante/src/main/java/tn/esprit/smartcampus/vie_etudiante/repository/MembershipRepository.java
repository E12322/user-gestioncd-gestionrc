package tn.esprit.smartcampus.vie_etudiante.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;

import java.util.List;
import java.util.Optional;

@Repository
public interface MembershipRepository extends MongoRepository<Membership, String> {
    List<Membership> findByClubId(String clubId);
    List<Membership> findByClubIdAndStatus(String clubId, String status);
    Optional<Membership> findByClubIdAndMemberId(String clubId, String memberId);
    List<Membership> findByMemberId(String memberId);
    List<Membership> findAllByOrderByRequestedAtDesc();
    long countByClubIdAndStatus(String clubId, String status);
    void deleteByClubIdAndMemberId(String clubId, String memberId);
    void deleteByClubId(String clubId);
}
