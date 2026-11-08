package tn.esprit.smartcampus.vie_etudiante.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tn.esprit.smartcampus.vie_etudiante.dto.EventInputDTO;
import tn.esprit.smartcampus.vie_etudiante.exception.ApiException;
import tn.esprit.smartcampus.vie_etudiante.model.CampusEvent;
import tn.esprit.smartcampus.vie_etudiante.model.Club;
import tn.esprit.smartcampus.vie_etudiante.model.EventRegistration;
import tn.esprit.smartcampus.vie_etudiante.repository.ClubRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRegistrationRepository;
import tn.esprit.smartcampus.vie_etudiante.repository.EventRepository;
import tn.esprit.smartcampus.vie_etudiante.security.JwtPrincipal;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final ClubRepository clubRepository;
    private final EventRegistrationRepository eventRegistrationRepository;

    public List<CampusEvent> listEvents(String clubId) {
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        if (clubId != null && !clubId.isBlank()) {
            return eventRepository.findByClubIdAndDateGreaterThanEqualOrderByDateAscStartAsc(clubId.trim(), today);
        }
        return eventRepository.findByDateGreaterThanEqualOrderByDateAscStartAsc(today);
    }

    public CampusEvent createEvent(EventInputDTO input, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }

        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        if (input.getDate().trim().compareTo(today) < 0) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "La date ne peut pas être dans le passé", "INVALID_DATE");
        }

        if (toMinutes(input.getEnd()) <= toMinutes(input.getStart())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "La fin doit être après le début", "INVALID_TIME_RANGE");
        }

        String clubId = null;
        String clubName = null;
        if (input.getClubId() != null && !input.getClubId().isBlank()) {
            Club club = clubRepository.findById(input.getClubId().trim())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Club introuvable", "CLUB_NOT_FOUND"));
            clubId = club.getId();
            clubName = club.getName();
        }

        CampusEvent event = CampusEvent.builder()
                .id("ev-" + UUID.randomUUID().toString().substring(0, 8))
                .title(input.getTitle().trim())
                .description(input.getDescription().trim())
                .date(input.getDate().trim())
                .start(input.getStart().trim())
                .end(input.getEnd().trim())
                .location(input.getLocation().trim())
                .clubId(clubId)
                .clubName(clubName)
                .build();

        return eventRepository.save(event);
    }

    private static int toMinutes(String hhmm) {
        String[] parts = hhmm.trim().split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    public void deleteEvent(String id, JwtPrincipal viewer) {
        if (viewer == null || !viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Réservé à l'administrateur", "FORBIDDEN");
        }
        CampusEvent event = eventRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Événement introuvable", "EVENT_NOT_FOUND"));
        eventRegistrationRepository.deleteByEventId(id);
        eventRepository.delete(event);
    }

    public EventRegistration registerForEvent(String eventId, JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }
        if (viewer.isAdmin()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Les administrateurs ne s'inscrivent pas aux événements", "FORBIDDEN");
        }
        CampusEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Événement introuvable", "EVENT_NOT_FOUND"));
        String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        if (event.getDate().compareTo(today) < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Cet événement est déjà passé", "EVENT_PAST");
        }
        if (eventRegistrationRepository.findByEventIdAndStudentId(eventId, viewer.id()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "Vous êtes déjà inscrit à cet événement", "ALREADY_REGISTERED");
        }
        EventRegistration reg = EventRegistration.builder()
                .id("reg-" + UUID.randomUUID().toString().substring(0, 8))
                .eventId(eventId)
                .eventTitle(event.getTitle())
                .studentId(viewer.id())
                .studentName(viewer.name())
                .registeredAt(Instant.now().toString())
                .build();
        return eventRegistrationRepository.save(reg);
    }

    public void unregisterFromEvent(String eventId, JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }
        EventRegistration reg = eventRegistrationRepository.findByEventIdAndStudentId(eventId, viewer.id())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Inscription introuvable", "REGISTRATION_NOT_FOUND"));
        eventRegistrationRepository.delete(reg);
    }

    public List<EventRegistration> listMyRegistrations(JwtPrincipal viewer) {
        if (viewer == null || viewer.id() == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentification requise", "UNAUTHORIZED");
        }
        return eventRegistrationRepository.findByStudentId(viewer.id());
    }
}
