package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.dto.ClotureInterventionDTO;
import com.smartcampus.ressources.dto.InterventionRequestDTO;
import com.smartcampus.ressources.dto.InterventionResponseDTO;
import com.smartcampus.ressources.entity.Equipement;
import com.smartcampus.ressources.entity.Intervention;
import com.smartcampus.ressources.enums.StatutIntervention;
import com.smartcampus.ressources.enums.TypeIntervention;
import com.smartcampus.ressources.exception.AccesNonAutoriseException;
import com.smartcampus.ressources.exception.RessourceNotFoundException;
import com.smartcampus.ressources.service.RessourceEvent;
import com.smartcampus.ressources.service.RessourceEventPublisher;
import com.smartcampus.ressources.enums.RessourceEventType;
import com.smartcampus.ressources.repository.EquipementRepository;
import com.smartcampus.ressources.repository.InterventionRepository;
import com.smartcampus.ressources.security.IAuthentification;
import com.smartcampus.ressources.security.UtilisateurInfo;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class InterventionServiceImpl implements IInterventionService {

    private final InterventionRepository interventionRepository;
    private final EquipementRepository equipementRepository;
    private final IAuthentification authentification;
    private final RessourceEventPublisher eventPublisher;

    public InterventionServiceImpl(InterventionRepository interventionRepository,
                                   EquipementRepository equipementRepository,
                                   IAuthentification authentification,
                                   RessourceEventPublisher eventPublisher) {
        this.interventionRepository = interventionRepository;
        this.equipementRepository = equipementRepository;
        this.authentification = authentification;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public InterventionResponseDTO planifierIntervention(InterventionRequestDTO dto, Long planificateurId) {
        if (!authentification.verifierAcces(planificateurId, "RESPONSABLE")
                && !authentification.verifierAcces(planificateurId, "ADMINISTRATEUR")
                && !authentification.verifierAcces(planificateurId, "TECHNICIEN")) {
            throw new AccesNonAutoriseException("Non autorisé à planifier une intervention.");
        }

        Equipement eq = equipementRepository.findById(dto.equipementId())
                .orElseThrow(() -> new RessourceNotFoundException("Equipement introuvable : " + dto.equipementId()));

        UtilisateurInfo auteur = authentification.obtenirUtilisateur(dto.auteurId());

        Intervention intervention = new Intervention(
                dto.typeIntervention(),
                dto.description(),
                dto.coutEstime(),
                eq,
                dto.auteurId(),
                auteur != null ? auteur.nom() : "Auteur " + dto.auteurId(),
                dto.datePlanifiee()
        );
        intervention.planifierIntervention();
        Intervention saved = interventionRepository.save(intervention);

        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.INTERVENTION_PLANIFIEE,
                "Intervention",
                saved.getId(),
                planificateurId,
                auteur != null ? auteur.nom() : "Planificateur",
                "Planification de maintenance " + dto.typeIntervention() + " pour l'équipement " + eq.getNom(),
                null
        ));

        return InterventionResponseDTO.fromEntity(saved);
    }

    @Override
    public InterventionResponseDTO demarrerTraitement(Long interventionId, Long technicienId) {
        if (!authentification.verifierAcces(technicienId, "TECHNICIEN")
                && !authentification.verifierAcces(technicienId, "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un technicien peut traiter une demande de maintenance.");
        }

        Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new RessourceNotFoundException("Intervention introuvable : " + interventionId));

        UtilisateurInfo tech = authentification.obtenirUtilisateur(technicienId);
        intervention.demarrerTraitement(technicienId, tech != null ? tech.nom() : "Technicien " + technicienId);
        Intervention saved = interventionRepository.save(intervention);

        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.INTERVENTION_EN_COURS,
                "Intervention",
                saved.getId(),
                technicienId,
                tech != null ? tech.nom() : "Technicien",
                "Prise en charge de la maintenance #" + saved.getId() + " sur " + saved.getEquipement().getNom(),
                null
        ));

        return InterventionResponseDTO.fromEntity(saved);
    }

    @Override
    public InterventionResponseDTO cloturerIntervention(Long interventionId, ClotureInterventionDTO dto) {
        if (!authentification.verifierAcces(dto.technicienId(), "TECHNICIEN")
                && !authentification.verifierAcces(dto.technicienId(), "ADMINISTRATEUR")) {
            throw new AccesNonAutoriseException("Seul un technicien peut clôturer une maintenance.");
        }

        Intervention intervention = interventionRepository.findById(interventionId)
                .orElseThrow(() -> new RessourceNotFoundException("Intervention introuvable : " + interventionId));

        intervention.cloturerIntervention(dto.rapportTechnique());
        Intervention saved = interventionRepository.save(intervention);

        UtilisateurInfo tech = authentification.obtenirUtilisateur(dto.technicienId());
        eventPublisher.notifier(new RessourceEvent(
                RessourceEventType.INTERVENTION_CLOTUREE,
                "Intervention",
                saved.getId(),
                dto.technicienId(),
                tech != null ? tech.nom() : "Technicien",
                "Clôture de la maintenance #" + saved.getId() + ". Équipement remis en service.",
                null
        ));

        return InterventionResponseDTO.fromEntity(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public InterventionResponseDTO getIntervention(Long id) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new RessourceNotFoundException("Intervention introuvable : " + id));
        return InterventionResponseDTO.fromEntity(intervention);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InterventionResponseDTO> getAllInterventions() {
        return interventionRepository.findAll().stream()
                .map(InterventionResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InterventionResponseDTO> getInterventionsTechnicien(Long technicienId) {
        return interventionRepository.findByTechnicienId(technicienId).stream()
                .map(InterventionResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InterventionResponseDTO> getInterventionsParStatut(StatutIntervention statut) {
        return interventionRepository.findByStatut(statut).stream()
                .map(InterventionResponseDTO::fromEntity)
                .toList();
    }

    @Override
    @Scheduled(cron = "0 0 2 * * *") // Chaque nuit à 2h du matin
    public List<InterventionResponseDTO> verifierEtGenererMaintenancesPreventives() {
        List<Equipement> equipements = equipementRepository.findAll();
        List<InterventionResponseDTO> generees = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (Equipement eq : equipements) {
            if (eq.getPeriodiciteMaintenanceJours() != null && eq.getPeriodiciteMaintenanceJours() > 0) {
                LocalDate derniere = eq.getDateDerniereMaintenance() != null
                        ? eq.getDateDerniereMaintenance()
                        : today.minusDays(eq.getPeriodiciteMaintenanceJours());

                LocalDate prochaine = derniere.plusDays(eq.getPeriodiciteMaintenanceJours());

                if (!prochaine.isAfter(today)) {
                    // Vérifier si une maintenance préventive n'est pas déjà planifiée ou en cours
                    boolean existeDeja = interventionRepository.findByEquipementId(eq.getId()).stream()
                            .anyMatch(i -> i.getTypeIntervention() == TypeIntervention.PREVENTIVE
                                    && (i.getStatut() == StatutIntervention.PLANIFIEE || i.getStatut() == StatutIntervention.EN_COURS));

                    if (!existeDeja) {
                        Intervention preventive = new Intervention(
                                TypeIntervention.PREVENTIVE,
                                "Maintenance préventive périodique programmée (" + eq.getPeriodiciteMaintenanceJours() + " jours)",
                                0.0f,
                                eq,
                                5L, // Administrateur / Système
                                "Système SmartCampus",
                                LocalDateTime.now().plusDays(2)
                        );
                        preventive.planifierIntervention();
                        Intervention saved = interventionRepository.save(preventive);
                        generees.add(InterventionResponseDTO.fromEntity(saved));

                        eventPublisher.notifier(new RessourceEvent(
                                RessourceEventType.ALERTE_MAINTENANCE_PREVENTIVE,
                                "Equipement",
                                eq.getId(),
                                5L,
                                "Système SmartCampus",
                                "Maintenance préventive planifiée pour " + eq.getNom() + " (Échéance dépassée)",
                                null
                        ));
                    }
                }
            }
        }
        return generees;
    }
}
