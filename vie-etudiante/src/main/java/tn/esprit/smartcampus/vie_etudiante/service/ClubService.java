package tn.esprit.smartcampus.vie_etudiante.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubDetailDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubInputDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubViewDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.MemberDetailDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.MyMembershipDTO;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRegistrationRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClubService {

    private final ClubRepository clubRepository;
    private final MembershipRepository membershipRepository;
    private final EventRepository eventRepository;
    private final EventRegistrationRepository eventRegistrationRepository;
    private final MongoTemplate mongoTemplate;

    public List<ClubViewDTO> listClubs(String q, String category, JwtPrincipal viewer) {
        Query query = new Query();

        if (category != null && !category.isBlank()) {
            query.addCriteria(Criteria.where("category").is(category.trim()));
        }

        if (q != null && !q.isBlank()) {
            String regex = ".*" + q.trim() + ".*";
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("name").regex(regex, "i"),
                    Criteria.where("category").regex(regex, "i"),
                    Criteria.where("description").regex(regex, "i")
            ));
        }

        List<Club> clubs = mongoTemplate.find(query, Club.class);

        // Récupérer les adhésions de l'utilisateur courant pour renseigner myMembership
        Map<String, Membership> myMembershipsByClubId = Map.of();
        if (viewer != null && viewer.id() != null) {
            List<Membership> myMemberships = membershipRepository.findByMemberId(viewer.id());
            myMembershipsByClubId = myMemberships.stream()
                    .collect(Collectors.toMap(Membership::getClubId, m -> m, (existing, replace) -> existing));
        }

        final Map<String, Membership> finalMemberships = myMembershipsByClubId;
        return clubs.stream().map(c -> {
            Membership m = finalMemberships.get(c.getId());
            MyMembershipDTO myDto = m != null ? new MyMembershipDTO(m.getId(), m.getStatus()) : null;
            return ClubViewDTO.builder()
                    .id(c.getId())
                    .name(c.getName())
                    .category(c.getCategory())
                    .description(c.getDescription())
                    .meetingPlace(c.getMeetingPlace())
                    .members(c.getMembers())
                    .maxMembers(c.getMaxMembers())
                    .myMembership(myDto)
                    .build();
        }).toList();
    }

    public ClubDetailDTO getClub(String id, JwtPrincipal viewer) {
        Club club = clubRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));

        // Noms des membres confirmés
        List<Membership> confirmedMembers = membershipRepository.findByClubIdAndStatus(id, "confirmed");
        List<String> memberNames = confirmedMembers.stream()
                .map(Membership::getMemberName)
                .toList();

        // Événements à venir du club
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        List<CampusEvent> events = eventRepository.findByClubIdAndDateGreaterThanEqualOrderByDateAscStartAsc(id, today);

        // Adhésion personnelle
        MyMembershipDTO myDto = null;
        if (viewer != null && viewer.id() != null) {
            var maybeM = membershipRepository.findByClubIdAndMemberId(id, viewer.id());
            if (maybeM.isPresent()) {
                myDto = new MyMembershipDTO(maybeM.get().getId(), maybeM.get().getStatus());
            }
        }

        return ClubDetailDTO.builder()
                .id(club.getId())
                .name(club.getName())
                .category(club.getCategory())
                .description(club.getDescription())
                .meetingPlace(club.getMeetingPlace())
                .members(club.getMembers())
                .maxMembers(club.getMaxMembers())
                .myMembership(myDto)
                .memberNames(memberNames)
                .events(events)
                .build();
    }

    public Club createClub(ClubInputDTO input, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }

        String name = input.getName().trim();
        if (clubRepository.existsByNameIgnoreCase(name)) {
            throw new ApiException(HttpStatus.CONFLICT, "Un club porte déjà ce nom", "CLUB_EXISTS", List.of(name));
        }

        Club created = Club.builder()
                .id("k" + UUID.randomUUID().toString().substring(0, 8))
                .name(name)
                .category(input.getCategory().trim())
                .description(input.getDescription().trim())
                .meetingPlace(input.getMeetingPlace().trim())
                .members(0)
                .maxMembers(input.getMaxMembers())
                .build();

        return clubRepository.save(created);
    }

    public void deleteClub(String id, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }
        Club club = clubRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));
        // Supprimer les adhésions, événements et inscriptions liés
        membershipRepository.deleteByClubId(id);
        List<CampusEvent> clubEvents = eventRepository.findByClubId(id);
        for (CampusEvent event : clubEvents) {
            eventRegistrationRepository.deleteByEventId(event.getId());
        }
        eventRepository.deleteAll(clubEvents);
        clubRepository.delete(club);
    }

    public List<MemberDetailDTO> listClubMembers(String clubId, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }
        clubRepository.findById(clubId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));
        return membershipRepository.findByClubId(clubId).stream()
                .map(m -> MemberDetailDTO.builder()
                        .memberId(m.getMemberId())
                        .memberName(m.getMemberName())
                        .memberRole(m.getMemberRole())
                        .status(m.getStatus())
                        .requestedAt(m.getRequestedAt())
                        .decidedAt(m.getDecidedAt())
                        .build())
                .toList();
    }
}
