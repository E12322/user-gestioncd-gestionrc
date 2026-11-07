package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ReservationRequestDTO;
import com.smartcampus.ressources.dto.ReservationResponseDTO;
import com.smartcampus.ressources.entity.Reservation;
import com.smartcampus.ressources.entity.Ressource;
import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.enums.StatutReservation;
import com.smartcampus.ressources.exception.AccesNonAutoriseException;
import com.smartcampus.ressources.exception.CapaciteDepasseeException;
import com.smartcampus.ressources.exception.ConflitReservationException;
import com.smartcampus.ressources.exception.RessourceNotFoundException;
import com.smartcampus.ressources.service.RessourceEvent;
import com.smartcampus.ressources.service.RessourceEventPublisher;
import com.smartcampus.ressources.enums.RessourceEventType;
import com.smartcampus.ressources.repository.ReservationRepository;
import com.smartcampus.ressources.repository.RessourceRepository;
import com.smartcampus.ressources.security.IAuthentification;
import com.smartcampus.ressources.security.UtilisateurInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class ReservationServiceImpl implements IReservationService {

    private final ReservationRepository reservationRepository;
    private final RessourceRepository ressourceRepository;
    private final IAuthentification authentification;
    private final RessourceEventPublisher eventPublisher;

    public ReservationServiceImpl(ReservationRepository reservationRepository,
                                  RessourceRepository ressourceRepository,
                                  IAuthentification authentification,
                                  RessourceEventPublisher eventPublisher) {
        this.reservationRepository = reservationRepository;
        this.ressourceRepository = ressourceRepository;
        this.authentification = authentification;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public ReservationResponseDTO demanderReservation(ReservationRequestDTO dto) {
        // Règle métier : Seul un enseignant ou un responsable peut demander une réservation
        UtilisateurInfo demandeur = authentification.obtenirUtilisateur(dto.demandeurId());
        if (demandeur == null || (!authentification.verifierAcces(dto.demandeurId(), "ENSEIGNANT")
                && !authentification.verifierAcces(dto.demandeurId(), "RESPONSABLE"))) {
            throw new AccesNonAutoriseException("Seul un enseignant ou un responsable peut demander une réservation.");
        }

        if (dto.dateFin().isBefore(dto.dateDebut()) || dto.dateFin().isEqual(dto.dateDebut())) {
            throw new IllegalArgumentException("La date de fin doit être postérieure à la date de début.");
        }

        Ressource ressource = ressourceRepository.findById(dto.ressourceId())
                .orElseThrow(() -> new RessourceNotFoundException("Ressource introuvable : " + dto.ressourceId()));

        if (!ressource.isDisponible()) {
            throw new ConflitReservationException("La ressource " + ressource.getNumero() + " est actuellement indisponible.");
        }

        // Règle métier : Le nombre de participants ne doit pas dépasser la capacité de la salle
        if (ressource instanceof Salle salle) {
            if (dto.nombreParticipants() > salle.getCapacite()) {
                throw new CapaciteDepasseeException("Le nombre de participants (" + dto.nombreParticipants() +
                        ") dépasse la capacité maximale de la salle (" + salle.getCapacite() + ").");
            }
        }

        // Règle métier : Une salle ne peut pas être réservée deux fois sur le même créneau
        List<Reservation> conflits = reservationRepository.findConflictingReservations(
                ressource.getId(), dto.dateDebut(), dto.dateFin());
        if (!conflits.isEmpty()) {
            throw new ConflitReservationException("La ressource " + ressource.getNumero() +
                    " est déjà réservée ou en attente de validation sur ce créneau.");
        }

        Reservation reservation = new Reservation(
                ressource,
                dto.dateDebut(),
                dto.dateFin(),
                dto.motif(),
                dto.nombreParticipants(),
                demandeur.id(),
                demandeur.nom(),
                demandeur.email(),
                demandeur.role()
        );
        reservation.creerReservation();
        Reservation saved = reservationRepository.save(reservation);

        // Notification observateurs
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.RESERVATION_CREEE,
                "Reservation",
                saved.getId(),
                demandeur.id(),
                demandeur.nom(),
                "Nouvelle demande de réservation pour la ressource " + ressource.getNumero() + " du " + dto.dateDebut() + " au " + dto.dateFin(),
                demandeur.email()
        ));

        return ReservationResponseDTO.fromEntity(saved);
    }

    @Override
    public ReservationResponseDTO modifierReservation(Long reservationId, ReservationRequestDTO dto, Long demandeurId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + reservationId));

        if (!reservation.getDemandeurId().equals(demandeurId) && !authentification.verifierAcces(demandeurId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul l'auteur de la demande peut la modifier.");
        }

        if (reservation.getStatut() == StatutReservation.ANNULEE || reservation.getStatut() == StatutReservation.REFUSEE) {
            throw new IllegalStateException("Impossible de modifier une réservation déjà refusée ou annulée.");
        }

        Ressource ressource = ressourceRepository.findById(dto.ressourceId())
                .orElseThrow(() -> new RessourceNotFoundException("Ressource introuvable : " + dto.ressourceId()));

        if (ressource instanceof Salle salle && dto.nombreParticipants() > salle.getCapacite()) {
            throw new CapaciteDepasseeException("Le nombre de participants dépasse la capacité de la salle.");
        }

        List<Reservation> conflits = reservationRepository.findConflictingReservationsExcluding(
                ressource.getId(), reservationId, dto.dateDebut(), dto.dateFin());
        if (!conflits.isEmpty()) {
            throw new ConflitReservationException("Conflit avec une autre réservation existante sur ce créneau.");
        }

        reservation.setRessource(ressource);
        reservation.setDateDebut(dto.dateDebut());
        reservation.setDateFin(dto.dateFin());
        reservation.setMotif(dto.motif());
        reservation.setNombreParticipants(dto.nombreParticipants());
        reservation.setStatut(StatutReservation.DEMANDEE); // Repasse en attente de validation

        return ReservationResponseDTO.fromEntity(reservationRepository.save(reservation));
    }

    @Override
    public void annulerReservation(Long reservationId, Long demandeurId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + reservationId));

        if (!reservation.getDemandeurId().equals(demandeurId)
                && !authentification.verifierAcces(demandeurId, "RESPONSABLE")
                && !authentification.verifierAcces(demandeurId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Non autorisé à annuler cette réservation.");
        }

        reservation.annulerReservation();
        reservationRepository.save(reservation);

        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.RESERVATION_ANNULEE,
                "Reservation",
                reservation.getId(),
                demandeurId,
                reservation.getDemandeurNom(),
                "Annulation de la réservation pour " + reservation.getRessource().getNumero(),
                reservation.getDemandeurEmail()
        ));
    }

    @Override
    public ReservationResponseDTO validerReservation(Long reservationId, Long responsableId) {
        if (!authentification.verifierAcces(responsableId, "RESPONSABLE")
                && !authentification.verifierAcces(responsableId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un responsable peut valider une réservation.");
        }

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + reservationId));

        // Règle métier : Vérifier à nouveau la disponibilité au moment de la validation
        List<Reservation> conflits = reservationRepository.findConflictingReservationsExcluding(
                reservation.getRessource().getId(), reservationId, reservation.getDateDebut(), reservation.getDateFin())
                .stream().filter(r -> r.getStatut() == StatutReservation.VALIDEE).toList();

        if (!conflits.isEmpty()) {
            throw new ConflitReservationException("Impossible de valider : un autre créneau a déjà été validé.");
        }

        reservation.valider(responsableId);
        Reservation saved = reservationRepository.save(reservation);

        UtilisateurInfo resp = authentification.obtenirUtilisateur(responsableId);
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.RESERVATION_VALIDEE,
                "Reservation",
                saved.getId(),
                responsableId,
                resp != null ? resp.nom() : "Responsable",
                "Votre réservation pour " + saved.getRessource().getNumero() + " a été validée avec succès.",
                saved.getDemandeurEmail()
        ));

        return ReservationResponseDTO.fromEntity(saved);
    }

    @Override
    public ReservationResponseDTO refuserReservation(Long reservationId, Long responsableId, String motifRefus) {
        if (!authentification.verifierAcces(responsableId, "RESPONSABLE")
                && !authentification.verifierAcces(responsableId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un responsable peut refuser une réservation.");
        }

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + reservationId));

        reservation.refuser(responsableId, motifRefus);
        Reservation saved = reservationRepository.save(reservation);

        UtilisateurInfo resp = authentification.obtenirUtilisateur(responsableId);
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.RESERVATION_REFUSEE,
                "Reservation",
                saved.getId(),
                responsableId,
                resp != null ? resp.nom() : "Responsable",
                "Votre réservation pour " + saved.getRessource().getNumero() + " a été refusée. Motif : " + motifRefus,
                saved.getDemandeurEmail()
        ));

        return ReservationResponseDTO.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ReservationResponseDTO getReservation(Long id) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Réservation introuvable : " + id));
        return ReservationResponseDTO.fromEntity(reservation);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationResponseDTO> getReservationsUtilisateur(Long demandeurId) {
        return reservationRepository.findByDemandeurId(demandeurId).stream()
                .map(ReservationResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReservationResponseDTO> getAllReservations() {
        return reservationRepository.findAll().stream()
                .map(ReservationResponseDTO::fromEntity)
                .toList();
    }
}
