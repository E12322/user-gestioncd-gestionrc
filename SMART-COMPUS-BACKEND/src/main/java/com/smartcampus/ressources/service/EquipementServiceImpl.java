package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.*;
import com.smartcampus.ressources.entity.Equipement;
import com.smartcampus.ressources.entity.Intervention;
import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.enums.TypeIntervention;
import com.smartcampus.ressources.exception.AccesNonAutoriseException;
import com.smartcampus.ressources.exception.RessourceNotFoundException;
import com.smartcampus.ressources.service.RessourceEvent;
import com.smartcampus.ressources.service.RessourceEventPublisher;
import com.smartcampus.ressources.enums.RessourceEventType;
import com.smartcampus.ressources.repository.EquipementRepository;
import com.smartcampus.ressources.repository.InterventionRepository;
import com.smartcampus.ressources.repository.SalleRepository;
import com.smartcampus.ressources.security.IAuthentification;
import com.smartcampus.ressources.security.UtilisateurInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class EquipementServiceImpl implements IEquipementService {

    private final EquipementRepository equipementRepository;
    private final SalleRepository salleRepository;
    private final InterventionRepository interventionRepository;
    private final IAuthentification authentification;
    private final RessourceEventPublisher eventPublisher;

    public EquipementServiceImpl(EquipementRepository equipementRepository,
                                 SalleRepository salleRepository,
                                 InterventionRepository interventionRepository,
                                 IAuthentification authentification,
                                 RessourceEventPublisher eventPublisher) {
        this.equipementRepository = equipementRepository;
        this.salleRepository = salleRepository;
        this.interventionRepository = interventionRepository;
        this.authentification = authentification;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public EquipementResponseDTO creerEquipement(EquipementRequestDTO dto, Long adminId) {
        verifierRoleAdmin(adminId);

        Salle salle = null;
        if (dto.salleId() != null) {
            salle = salleRepository.findById(dto.salleId())
                    .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable : " + dto.salleId()));
        }

        Equipement eq = new Equipement(
                dto.idEquipement(),
                dto.nom(),
                dto.categorie(),
                salle,
                dto.serviceAffecte(),
                dto.periodiciteMaintenanceJours()
        );
        Equipement saved = equipementRepository.save(eq);

        return EquipementResponseDTO.fromEntity(saved);
    }

    @Override
    public EquipementResponseDTO modifierEquipement(Long id, EquipementRequestDTO dto, Long adminId) {
        verifierRoleAdmin(adminId);

        Equipement eq = equipementRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Equipement introuvable : " + id));

        Salle salle = null;
        if (dto.salleId() != null) {
            salle = salleRepository.findById(dto.salleId())
                    .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable : " + dto.salleId()));
        }

        eq.setIdEquipement(dto.idEquipement());
        eq.setNom(dto.nom());
        eq.setCategorie(dto.categorie());
        eq.setSalle(salle);
        eq.setServiceAffecte(dto.serviceAffecte());
        eq.setPeriodiciteMaintenanceJours(dto.periodiciteMaintenanceJours());

        return EquipementResponseDTO.fromEntity(equipementRepository.save(eq));
    }

    @Override
    public void supprimerEquipement(Long id, Long adminId) {
        verifierRoleAdmin(adminId);
        if (!equipementRepository.existsById(id)) {
            throw new RessourceNotFoundException("Equipement introuvable : " + id);
        }
        equipementRepository.deleteById(id);
    }

    @Override
    public EquipementResponseDTO affecterEquipement(Long id, AffectationEquipementDTO dto, Long adminId) {
        verifierRoleAdmin(adminId);

        Equipement eq = equipementRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Equipement introuvable : " + id));

        if (dto.salleId() != null) {
            Salle salle = salleRepository.findById(dto.salleId())
                    .orElseThrow(() -> new RessourceNotFoundException("Salle introuvable : " + dto.salleId()));
            eq.setSalle(salle);
        } else {
            eq.setSalle(null);
        }
        eq.setServiceAffecte(dto.serviceAffecte());

        return EquipementResponseDTO.fromEntity(equipementRepository.save(eq));
    }

    @Override
    @Transactional(readOnly = true)
    public EquipementResponseDTO getEquipement(Long id) {
        Equipement eq = equipementRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Equipement introuvable : " + id));
        return EquipementResponseDTO.fromEntity(eq);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EquipementResponseDTO> getAllEquipements() {
        return equipementRepository.findAll().stream()
                .map(EquipementResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EquipementResponseDTO> getEquipementsParSalle(Long salleId) {
        return equipementRepository.findBySalleId(salleId).stream()
                .map(EquipementResponseDTO::fromEntity)
                .toList();
    }

    @Override
    public InterventionResponseDTO signalerPanne(SignalementPanneDTO dto) {
        // BF3.12: Tout utilisateur actif peut signaler une panne
        if (!authentification.isCompteActif(dto.auteurId())) {
            throw new AccesNonAutoriseException("Utilisateur non authentifié ou inactif.");
        }
        UtilisateurInfo auteur = authentification.obtenirUtilisateur(dto.auteurId());

        Equipement eq = equipementRepository.findById(dto.equipementId())
                .orElseThrow(() -> new RessourceNotFoundException("Equipement introuvable : " + dto.equipementId()));

        // Règle métier : l'équipement passe en panne et devient indisponible
        eq.declarerPanne();
        equipementRepository.save(eq);

        // Création automatique de l'intervention de maintenance corrective
        Intervention intervention = new Intervention(
                TypeIntervention.CORRECTIVE,
                dto.description(),
                null,
                eq,
                dto.auteurId(),
                auteur != null ? auteur.nom() : "Auteur " + dto.auteurId(),
                LocalDateTime.now().plusDays(1) // date planifiée par défaut
        );
        intervention.planifierIntervention();
        Intervention saved = interventionRepository.save(intervention);

        // Notification observateurs
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.PANNE_DECLAREE,
                "Equipement",
                eq.getId(),
                dto.auteurId(),
                auteur != null ? auteur.nom() : "Utilisateur",
                "Signalement de panne sur l'équipement " + eq.getNom() + " (" + eq.getIdEquipement() + ") : " + dto.description(),
                null
        ));

        return InterventionResponseDTO.fromEntity(saved);
    }

    private void verifierRoleAdmin(Long adminId) {
        if (!authentification.verifierAcces(adminId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un administrateur peut gérer l'inventaire des équipements.");
        }
    }
}
