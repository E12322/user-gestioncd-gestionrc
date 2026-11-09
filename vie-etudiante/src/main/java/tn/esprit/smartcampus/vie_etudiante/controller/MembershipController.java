package tn.esprit.smartcampus.vie_etudiante.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tn.esprit.smartcampus.vie_etudiante.dto.MembershipStatusUpdateDTO;
import tn.esprit.smartcampus.vie_etudiante.model.Membership;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;
import tn.esprit.smartcampus.vie_etudiante.service.MembershipService;

import java.util.List;

@RestController
@RequestMapping("/memberships")
@RequiredArgsConstructor
public class MembershipController {

    private final MembershipService membershipService;

    @GetMapping
    public ResponseEntity<List<Membership>> listMemberships(
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(membershipService.listMemberships(viewer));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Membership> decideMembership(
            @PathVariable String id,
            @Valid @RequestBody MembershipStatusUpdateDTO body,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(membershipService.decideMembership(id, body.getStatus(), viewer));
    }

    @GetMapping("/mine")
    public ResponseEntity<List<Membership>> listMyMemberships(
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(membershipService.listMyMemberships(viewer));
    }
}
