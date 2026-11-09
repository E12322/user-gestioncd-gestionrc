package tn.esprit.smartcampus.vie_etudiante.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubDetailDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubInputDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.ClubViewDTO;
import tn.esprit.smartcampus.vie_etudiante.dto.MemberDetailDTO;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;
import tn.esprit.smartcampus.vie_etudiante.service.ClubService;
import tn.esprit.smartcampus.vie_etudiante.service.MembershipService;

import java.util.List;

@RestController
@RequestMapping("/clubs")
@RequiredArgsConstructor
public class ClubController {

    private final ClubService clubService;
    private final MembershipService membershipService;

    @GetMapping
    public ResponseEntity<List<ClubViewDTO>> listClubs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(clubService.listClubs(q, category, viewer));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClubDetailDTO> getClub(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(clubService.getClub(id, viewer));
    }

    @PostMapping
    public ResponseEntity<Club> createClub(
            @Valid @RequestBody ClubInputDTO input,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clubService.createClub(input, viewer));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<Membership> requestMembership(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(membershipService.requestMembership(id, viewer));
    }

    @DeleteMapping("/{id}/members/me")
    public ResponseEntity<Void> leaveClub(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        membershipService.leaveClub(id, viewer);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClub(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        clubService.deleteClub(id, viewer);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<MemberDetailDTO>> listClubMembers(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(clubService.listClubMembers(id, viewer));
    }
}
