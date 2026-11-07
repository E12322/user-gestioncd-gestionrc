package com.smartcampus.ressources.controller;

import com.smartcampus.ressources.dto.frontend.FrontendResourceDTOs.*;
import com.smartcampus.ressources.entity.Equipement;
import com.smartcampus.ressources.entity.Reservation;
import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.enums.StatutReservation;
import com.smartcampus.ressources.exception.CapaciteDepasseeException;
import com.smartcampus.ressources.exception.ConflitReservationException;
import com.smartcampus.ressources.exception.RessourceNotFoundException;
import com.smartcampus.ressources.service.RessourceEvent;
import com.smartcampus.ressources.service.RessourceEventPublisher;
import com.smartcampus.ressources.enums.RessourceEventType;
import com.smartcampus.ressources.repository.EquipementRepository;
import com.smartcampus.ressources.repository.ReservationRepository;
import com.smartcampus.ressources.repository.SalleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api")
public class FrontendResourceController {

    private final SalleRepository salleRepository;
    private final ReservationRepository reservationRepository;
    private final EquipementRepository equipementRepository;
    private final RessourceEventPublisher eventPublisher;

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int OPEN_HOURS = 11; // 8h à 19h

    public FrontendResourceController(SalleRepository salleRepository,
                                      ReservationRepository reservationRepository,
                                      EquipementRepository equipementRepository,
                                      RessourceEventPublisher eventPublisher) {
        this.salleRepository = salleRepository;
        this.reservationRepository = reservationRepository;
        this.equipementRepository = equipementRepository;
        this.eventPublisher = eventPublisher;
    }

    // ==========================================
    // GET /api/rooms
    // ==========================================
    @GetMapping("/rooms")
    public ResponseEntity<List<RoomViewDTO>> listRooms(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String building,
            @RequestParam(required = false) Integer minCapacity) {

        List<Salle> salles = salleRepository.findAll();
        List<RoomViewDTO> results = new ArrayList<>();
        String queryNorm = q != null ? q.trim().toLowerCase() : "";

        for (Salle s : salles) {
            if (building != null && !building.isBlank() && !s.getBatiment().equalsIgnoreCase(building)) {
                continue;
            }
            if (minCapacity != null && s.getCapacite() < minCapacity) {
                continue;
            }

            List<EquipmentDTO> eqList = getEquipmentsForSalle(s);

            if (!queryNorm.isEmpty()) {
                String searchTarget = (s.getNom() + " " + s.getBatiment() + " " + s.getNumero()).toLowerCase();
                boolean matchesEq = eqList.stream().anyMatch(e -> e.label().toLowerCase().contains(queryNorm));
                if (!searchTarget.contains(queryNorm) && !matchesEq) {
                    continue;
                }
            }

            // Calcul des heures réservées aujourd'hui
            double bookedHours = computeBookedHoursToday(s.getId());
            String kind = mapTypeToKind(s.getType().name());

            results.add(new RoomViewDTO(
                    s.getId().toString(),
                    s.getNom(),
                    s.getBatiment(),
                    s.getEtage(),
                    kind,
                    s.getCapacite(),
                    eqList,
                    bookedHours,
                    OPEN_HOURS
            ));
        }

        return ResponseEntity.ok(results);
    }

    // ==========================================
    // GET /api/rooms/{id}/availability?date=YYYY-MM-DD
    // ==========================================
    @GetMapping("/rooms/{id}/availability")
    public ResponseEntity<AvailabilityDTO> getAvailability(
            @PathVariable Long id,
            @RequestParam String date) {

        LocalDate localDate = LocalDate.parse(date);
        LocalDateTime startOfDay = localDate.atStartOfDay();
        LocalDateTime endOfDay = localDate.atTime(LocalTime.MAX);

        List<Reservation> reservations = reservationRepository.findConflictingReservations(id, startOfDay, endOfDay);
        List<BusySlotDTO> slots = new ArrayList<>();

        for (Reservation r : reservations) {
            if (r.getStatut() == StatutReservation.ANNULEE || r.getStatut() == StatutReservation.REFUSEE) {
                continue;
            }
            String status = r.getStatut() == StatutReservation.VALIDEE ? "confirmed" : "pending";
            slots.add(new BusySlotDTO(
                    r.getDateDebut().format(TIME_FORMAT),
                    r.getDateFin().format(TIME_FORMAT),
                    status
            ));
        }

        slots.sort(Comparator.comparing(BusySlotDTO::start));
        return ResponseEntity.ok(new AvailabilityDTO(id.toString(), date, slots));
    }

    // ==========================================
    // GET /api/reservations?scope=mine|all
    // ==========================================
    @GetMapping("/reservations")
    public ResponseEntity<List<FrontendReservationDTO>> listReservations(
            @RequestParam(defaultValue = "mine") String scope,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId) {

        List<Reservation> list;
        if ("all".equalsIgnoreCase(scope)) {
            list = reservationRepository.findAll();
        } else {
            list = reservationRepository.findByDemandeurId(userId);
        }

        List<FrontendReservationDTO> dtos = list.stream()
                .map(this::toFrontendReservationDTO)
                .sorted(Comparator.comparing(FrontendReservationDTO::requestedAt).reversed())
                .toList();

        return ResponseEntity.ok(dtos);
    }

    // ==========================================
    // POST /api/reservations
    // ==========================================
    @PostMapping("/reservations")
    public ResponseEntity<FrontendReservationDTO> createReservation(
            @RequestBody ReservationInputDTO input,
            @RequestHeader(value = "X-User-Id", defaultValue = "1") Long userId,
            @RequestHeader(value = "X-User-Name", defaultValue = "Karim Trabelsi") String userName,
            @RequestHeader(value = "X-User-Role", defaultValue = "teacher") String userRole) {

        Long salleId = Long.parseLong(input.roomId());
        Salle salle = salleRepository.findById(salleId)
                .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable avec l'ID : " + salleId));

        if (input.attendees() > salle.getCapacite()) {
            throw new CapaciteDepasseeException(salle.getNom() + " accueille au maximum " + salle.getCapacite() + " personnes");
        }

        LocalDate date = LocalDate.parse(input.date());
        LocalTime start = LocalTime.parse(input.start());
        LocalTime end = LocalTime.parse(input.end());

        LocalDateTime debut = LocalDateTime.of(date, start);
        LocalDateTime fin = LocalDateTime.of(date, end);

        // Conflit avec réservations confirmées
        List<Reservation> conflits = reservationRepository.findConflictingReservations(salleId, debut, fin)
                .stream().filter(r -> r.getStatut() == StatutReservation.VALIDEE).toList();

        if (!conflits.isEmpty()) {
            throw new ConflitReservationException(salle.getNom() + " est déjà réservée sur ce créneau");
        }

        boolean isAdmin = "admin".equalsIgnoreCase(userRole);
        Reservation reservation = new Reservation(
                salle,
                debut,
                fin,
                input.purpose(),
                input.attendees(),
                userId,
                userName,
                userName.toLowerCase().replace(" ", ".") + "@smartcampus.tn",
                isAdmin ? "ADMINISTRATEUR" : "ENSEIGNANT"
        );

        if (isAdmin) {
            reservation.valider(userId);
        } else {
            reservation.creerReservation();
        }

        Reservation saved = reservationRepository.save(reservation);

        eventPublisher.notifier(new RessourceEvent(
                isAdmin ? RessourceEventType.RESERVATION_VALIDEE : RessourceEventType.RESERVATION_CREEE,
                "Reservation",
                saved.getId(),
                userId,
                userName,
                "Réservation " + (isAdmin ? "confirmée" : "créée") + " pour " + salle.getNom() + " le " + input.date(),
                saved.getDemandeurEmail()
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(toFrontendReservationDTO(saved));
    }

    // ==========================================
    // PUT /api/reservations/{id}/status
    // ==========================================
    @PutMapping("/reservations/{id}/status")
    public ResponseEntity<FrontendReservationDTO> decideReservation(
            @PathVariable Long id,
            @RequestBody StatusUpdateDTO body,
            @RequestHeader(value = "X-User-Id", defaultValue = "5") Long adminId) {

        Reservation r = reservationRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + id));

        if ("confirmed".equalsIgnoreCase(body.status())) {
            // Re-vérifier les conflits
            List<Reservation> conflits = reservationRepository.findConflictingReservationsExcluding(
                    r.getRessource().getId(), id, r.getDateDebut(), r.getDateFin())
                    .stream().filter(c -> c.getStatut() == StatutReservation.VALIDEE).toList();

            if (!conflits.isEmpty()) {
                throw new ConflitReservationException("Conflit de réservation sur ce créneau");
            }
            r.valider(adminId);
        } else {
            r.refuser(adminId, "Refusée par l'administrateur");
        }

        Reservation saved = reservationRepository.save(r);
        return ResponseEntity.ok(toFrontendReservationDTO(saved));
    }

    // ==========================================
    // DELETE /api/reservations/{id}
    // ==========================================
    @DeleteMapping("/reservations/{id}")
    public ResponseEntity<Void> cancelReservation(@PathVariable Long id) {
        Reservation r = reservationRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + id));
        r.annulerReservation();
        reservationRepository.save(r);
        return ResponseEntity.noContent().build();
    }

    // --- Helpers ---
    private List<EquipmentDTO> getEquipmentsForSalle(Salle s) {
        List<EquipmentDTO> list = new ArrayList<>();
        if (s.isProjecteur()) {
            list.add(new EquipmentDTO("projector", "Vidéoprojecteur"));
        }
        if (s.isClimatisee()) {
            list.add(new EquipmentDTO("ac", "Climatisation"));
        }

        List<Equipement> equipements = equipementRepository.findBySalleId(s.getId());
        for (Equipement eq : equipements) {
            list.add(new EquipmentDTO(eq.getIdEquipement(), eq.getNom()));
        }

        if (list.isEmpty()) {
            list.add(new EquipmentDTO("whiteboard", "Tableau blanc"));
        }
        return list;
    }

    private double computeBookedHoursToday(Long salleId) {
        LocalDate today = LocalDate.now();
        List<Reservation> todayRes = reservationRepository.findConflictingReservations(
                salleId, today.atStartOfDay(), today.atTime(LocalTime.MAX));

        long totalMinutes = 0;
        for (Reservation r : todayRes) {
            if (r.getStatut() != StatutReservation.REFUSEE && r.getStatut() != StatutReservation.ANNULEE) {
                totalMinutes += java.time.Duration.between(r.getDateDebut(), r.getDateFin()).toMinutes();
            }
        }
        return Math.min(OPEN_HOURS, Math.round((totalMinutes / 60.0) * 10.0) / 10.0);
    }

    private String mapTypeToKind(String type) {
        return switch (type) {
            case "AMPHITHEATRE" -> "amphi";
            case "LABORATOIRE" -> "lab";
            case "SALLE_REUNION" -> "meeting";
            default -> "classroom";
        };
    }

    private FrontendReservationDTO toFrontendReservationDTO(Reservation r) {
        String status = switch (r.getStatut()) {
            case VALIDEE -> "confirmed";
            case REFUSEE -> "refused";
            default -> "pending";
        };

        String building = r.getRessource() instanceof Salle s ? s.getBatiment() : "Campus";

        return new FrontendReservationDTO(
                r.getId().toString(),
                r.getRessource().getId().toString(),
                r.getRessource().getNom(),
                building,
                r.getDemandeurId().toString(),
                r.getDemandeurNom(),
                r.getDateDebut().toLocalDate().toString(),
                r.getDateDebut().format(TIME_FORMAT),
                r.getDateFin().format(TIME_FORMAT),
                r.getNombreParticipants(),
                r.getMotif(),
                status,
                r.getDateDemande().toString(),
                r.getDateDecision() != null ? r.getDateDecision().toString() : null
        );
    }
}
