package tn.esprit.smartcampus.vie_etudiante.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.MembershipRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MembershipService {

    private final MembershipRepository membershipRepository;
    private final ClubRepository clubRepository;

    public Membership requestMembership(String clubId, JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }
        if (viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Les administrateurs gèrent les clubs, ils n'y adhèrent pas", "FORBIDDEN");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));

        var existing = membershipRepository.findByClubIdAndMemberId(clubId, viewer.id());
        if (existing.isPresent() && !"refused".equalsIgnoreCase(existing.get().getStatus())) {
            String msg = "confirmed".equalsIgnoreCase(existing.get().getStatus())
                    ? "Vous êtes déjà membre de ce club"
                    : "Vous avez déjà une demande en attente";
            throw new ApiException(HttpStatus.CONFLICT, msg, "ALREADY_MEMBER");
        }

        if (club.getMembers() >= club.getMaxMembers()) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    club.getName() + " est complet",
                    "CLUB_FULL",
                    List.of(club.getName() + " — " + club.getMembers() + "/" + club.getMaxMembers() + " membres")
            );
        }

        // Si l'utilisateur avait une adhésion refusée, on la supprime avant d'insérer la nouvelle
        existing.ifPresent(membershipRepository::delete);

        Membership created = Membership.builder()
                .id("m-" + UUID.randomUUID().toString().substring(0, 8))
                .clubId(club.getId())
                .clubName(club.getName())
                .memberId(viewer.id())
                .memberName(viewer.name())
                .memberRole(viewer.role())
                .status("pending")
                .requestedAt(Instant.now().toString())
                .build();

        return membershipRepository.save(created);
    }

    public void leaveClub(String clubId, JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));

        Membership m = membershipRepository.findByClubIdAndMemberId(clubId, viewer.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Aucune adhésion à retirer", "MEMBERSHIP_NOT_FOUND"));

        if ("refused".equalsIgnoreCase(m.getStatus())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Aucune adhésion à retirer", "MEMBERSHIP_NOT_FOUND");
        }

        if ("confirmed".equalsIgnoreCase(m.getStatus())) {
            club.setMembers(Math.max(0, club.getMembers() - 1));
            clubRepository.save(club);
        }

        membershipRepository.delete(m);
    }

    public List<Membership> listMemberships(JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }
        return membershipRepository.findAllByOrderByRequestedAtDesc();
    }

    public Membership decideMembership(String id, String status, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }

        Membership m = membershipRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Adhésion introuvable", "MEMBERSHIP_NOT_FOUND"));

        if (!"pending".equalsIgnoreCase(m.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "Cette demande a déjà été traitée", "ALREADY_DECIDED");
        }

        if ("confirmed".equalsIgnoreCase(status)) {
            Club club = clubRepository.findById(m.getClubId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));

            if (club.getMembers() >= club.getMaxMembers()) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        club.getName() + " est complet",
                        "CLUB_FULL",
                        List.of(club.getName() + " — " + club.getMembers() + "/" + club.getMaxMembers() + " membres")
                );
            }

            club.setMembers(club.getMembers() + 1);
            clubRepository.save(club);
        }

        m.setStatus(status.toLowerCase());
        m.setDecidedAt(Instant.now().toString());
        return membershipRepository.save(m);
    }

    public List<Membership> listMyMemberships(JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }
        return membershipRepository.findByMemberId(viewer.id());
    }
}
