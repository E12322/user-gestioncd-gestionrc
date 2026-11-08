package tn.esprit.smartcampus.vie_etudiante.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tn.esprit.smartcampus.vie_etudiante.dto.EventInputDTO;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;
import tn.esprit.smartcampus.vie_etudiante.model.EventRegistration;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;
import tn.esprit.smartcampus.vie_etudiante.service.EventService;

import java.util.List;

@RestController
@RequestMapping("/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<List<CampusEvent>> listEvents(
            @RequestParam(required = false) String clubId) {
        return ResponseEntity.ok(eventService.listEvents(clubId));
    }

    @PostMapping
    public ResponseEntity<CampusEvent> createEvent(
            @Valid @RequestBody EventInputDTO input,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.createEvent(input, viewer));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        eventService.deleteEvent(id, viewer);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/register")
    public ResponseEntity<EventRegistration> registerForEvent(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.registerForEvent(id, viewer));
    }

    @DeleteMapping("/{id}/register")
    public ResponseEntity<Void> unregisterFromEvent(
            @PathVariable String id,
            @AuthenticationPrincipal JwtPrincipal viewer) {
        eventService.unregisterFromEvent(id, viewer);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my-registrations")
    public ResponseEntity<List<EventRegistration>> listMyRegistrations(
            @AuthenticationPrincipal JwtPrincipal viewer) {
        return ResponseEntity.ok(eventService.listMyRegistrations(viewer));
    }
}
