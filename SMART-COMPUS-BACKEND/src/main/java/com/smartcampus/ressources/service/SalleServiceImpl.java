package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.SalleRequestDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;
import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.exception.AccesNonAutoriseException;
import com.smartcampus.ressources.exception.RessourceNotFoundException;
import com.smartcampus.ressources.service.RessourceEvent;
import com.smartcampus.ressources.service.RessourceEventPublisher;
import com.smartcampus.ressources.enums.RessourceEventType;
import com.smartcampus.ressources.repository.ReservationRepository;
import com.smartcampus.ressources.repository.SalleRepository;
import com.smartcampus.ressources.security.IAuthentification;
import com.smartcampus.ressources.security.UtilisateurInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class SalleServiceImpl implements ISalleService {

    private final SalleRepository salleRepository;
    private final ReservationRepository reservationRepository;
    private final IAuthentification authentification;
    private final RessourceEventPublisher eventPublisher;

    public SalleServiceImpl(SalleRepository salleRepository,
                            ReservationRepository reservationRepository,
                            IAuthentification authentification,
                            RessourceEventPublisher eventPublisher) {
        this.salleRepository = salleRepository;
        this.reservationRepository = reservationRepository;
        this.authentification = authentification;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public SalleResponseDTO creerSalle(SalleRequestDTO dto, Long adminId) {
        verifierRoleAdmin(adminId);

        Salle salle = new Salle(
                dto.numero(),
                dto.nom(),
                dto.type(),
                dto.capacite(),
                dto.batiment(),
                dto.etage(),
                dto.projecteur(),
                dto.climatisee()
        );
        Salle saved = salleRepository.save(salle);

        UtilisateurInfo admin = authentification.obtenirUtilisateur(adminId);
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.RESERVATION_CREEE,
                "Salle",
                saved.getId(),
                adminId,
                admin != null ? admin.nom() : "Admin",
                "Création de la salle " + saved.getNumero(),
                null
        ));

        return SalleResponseDTO.fromEntity(saved);
    }

    @Override
    public SalleResponseDTO modifierSalle(Long id, SalleRequestDTO dto, Long adminId) {
        verifierRoleAdmin(adminId);

        Salle salle = salleRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable avec l'id : " + id));

        salle.setNumero(dto.numero());
        salle.setNom(dto.nom());
        salle.setType(dto.type());
        salle.setCapacite(dto.capacite());
        salle.setBatiment(dto.batiment());
        salle.setEtage(dto.etage());
        salle.setProjecteur(dto.projecteur());
        salle.setClimatisee(dto.climatisee());

        return SalleResponseDTO.fromEntity(salleRepository.save(salle));
    }

    @Override
    public void supprimerSalle(Long id, Long adminId) {
        verifierRoleAdmin(adminId);
        if (!salleRepository.existsById(id)) {
            throw new RessourceNotFoundException("Salle introuvable avec l'id : " + id);
        }
        salleRepository.deleteById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public SalleResponseDTO getSalle(Long id) {
        Salle salle = salleRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable avec l'id : " + id));
        return SalleResponseDTO.fromEntity(salle);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SalleResponseDTO> getAllSalles() {
        return salleRepository.findAll().stream()
                .map(SalleResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<SalleResponseDTO> rechercherSallesLibres(LocalDateTime debut, LocalDateTime fin, int capaciteMin) {
        if (fin.isBefore(debut) || fin.isEqual(debut)) {
            throw new IllegalArgumentException("La date de fin doit être postérieure à la date de début");
        }
        return reservationRepository.findAvailableSalles(debut, fin, capaciteMin).stream()
                .map(SalleResponseDTO::fromEntity)
                .toList();
    }

    private void verifierRoleAdmin(Long adminId) {
        if (!authentification.verifierAcces(adminId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un administrateur peut effectuer cette action sur les salles.");
        }
    }
}
