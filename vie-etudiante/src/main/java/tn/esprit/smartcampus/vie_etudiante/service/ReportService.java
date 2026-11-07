package tn.esprit.smartcampus.vie_etudiante.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubReportDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.MemberDetailDTO;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ClubRepository clubRepository;
    private final EventRepository eventRepository;
    private final MembershipRepository membershipRepository;

    public ClubReportDTO generateClubReport(String clubId, int year, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));

        String startDate = year + "-01-01";
        String endDate = year + "-12-31";

        List<CampusEvent> events = eventRepository
                .findByClubIdAndDateBetweenOrderByDateAscStartAsc(clubId, startDate, endDate);

        List<Membership> memberships = membershipRepository.findByClubId(clubId);

        List<MemberDetailDTO> memberDetails = memberships.stream()
                .map(m -> MemberDetailDTO.builder()
                        .memberId(m.getMemberId())
                        .memberName(m.getMemberName())
                        .memberRole(m.getMemberRole())
                        .status(m.getStatus())
                        .requestedAt(m.getRequestedAt())
                        .decidedAt(m.getDecidedAt())
                        .build())
                .toList();

        long confirmed = memberships.stream().filter(m -> "confirmed".equalsIgnoreCase(m.getStatus())).count();
        long pending = memberships.stream().filter(m -> "pending".equalsIgnoreCase(m.getStatus())).count();
        long refused = memberships.stream().filter(m -> "refused".equalsIgnoreCase(m.getStatus())).count();

        return ClubReportDTO.builder()
                .clubId(club.getId())
                .clubName(club.getName())
                .category(club.getCategory())
                .year(year)
                .totalMembers(memberships.size())
                .confirmedMembers((int) confirmed)
                .pendingMembers((int) pending)
                .refusedMembers((int) refused)
                .totalEvents(events.size())
                .events(events)
                .members(memberDetails)
                .build();
    }
}
