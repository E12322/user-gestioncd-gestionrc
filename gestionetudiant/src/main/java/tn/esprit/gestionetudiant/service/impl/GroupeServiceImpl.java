package tn.esprit.gestionetudiant.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AffectationDTO;
import tn.esprit.gestionetudiant.dto.EtudiantDTO;
import tn.esprit.gestionetudiant.dto.GroupeDTO;
import tn.esprit.gestionetudiant.entity.*;
import tn.esprit.gestionetudiant.event.CoursAffecteAuGroupeEvent;
import tn.esprit.gestionetudiant.event.EtudiantAjouteAuGroupeEvent;
import tn.esprit.gestionetudiant.event.InscriptionCreeeEvent;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.AffectationCoursRepository;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.GroupeRepository;
import tn.esprit.gestionetudiant.repository.InscriptionRepository;
import tn.esprit.gestionetudiant.repository.SeanceRepository;
import tn.esprit.gestionetudiant.service.IGroupeService;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupeServiceImpl implements IGroupeService {

    private final GroupeRepository groupeRepository;
    private final CoursRepository coursRepository;
    private final SeanceRepository seanceRepository;
    private final AffectationCoursRepository affectationRepository;
    private final InscriptionRepository inscriptionRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Override
    @Transactional
    public GroupeDTO creer(GroupeDTO dto) {
        Cours cours = null;
        if (dto.getCoursId() != null) {
            cours = getCours(dto.getCoursId());
            validerCapacite(cours, dto.getCapacite());
            if (groupeRepository.existsByCoursIdAndNomIgnoreCase(cours.getId(), dto.getNom().trim())) {
                throw new ConflictException("Un groupe nommé « " + dto.getNom() + " » existe déjà pour ce cours.");
            }
        } else {
            if (groupeRepository.existsByNomIgnoreCase(dto.getNom().trim())) {
                throw new ConflictException("Un groupe nommé « " + dto.getNom() + " » existe déjà.");
            }
        }

        Groupe groupe = new Groupe();
        groupe.setNom(dto.getNom().trim());
        groupe.setType(dto.getType());
        groupe.setCapacite(dto.getCapacite());
        groupe.setCours(cours);
        Groupe saved = groupeRepository.save(groupe);

        if (cours != null) {
            // Le cours de création est automatiquement affecté à la classe
            affecterInterne(saved, cours, dto.getType());
        }
        return mapToDTO(saved, affectationRepository.findByGroupeIdWithCours(saved.getId()));
    }

    @Override
    @Transactional
    public GroupeDTO modifier(Long id, GroupeDTO dto) {
        Groupe groupe = getEntity(id);
        Cours cours = null;
        if (dto.getCoursId() != null) {
            cours = getCours(dto.getCoursId());
            validerCapacite(cours, dto.getCapacite());
            if (groupeRepository.existsByCoursIdAndNomIgnoreCaseAndIdNot(cours.getId(), dto.getNom().trim(), id)) {
                throw new ConflictException("Un groupe nommé « " + dto.getNom() + " » existe déjà pour ce cours.");
            }
        } else {
            if (groupeRepository.existsByNomIgnoreCaseAndIdNot(dto.getNom().trim(), id)) {
                throw new ConflictException("Un groupe nommé « " + dto.getNom() + " » existe déjà.");
            }
        }

        groupe.setNom(dto.getNom().trim());
        groupe.setType(dto.getType());
        groupe.setCapacite(dto.getCapacite());
        groupe.setCours(cours);
        Groupe saved = groupeRepository.save(groupe);
        return mapToDTO(saved, affectationRepository.findByGroupeIdWithCours(saved.getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public GroupeDTO consulterParId(Long id) {
        Groupe groupe = groupeRepository.findByIdWithEtudiants(id)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + id));
        return mapToDTO(groupe, affectationRepository.findByGroupeIdWithCours(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<GroupeDTO> lister(Long coursId, int page, int size) {
        Map<Long, List<AffectationCours>> affectationsParGroupe = new HashMap<>();
        for (AffectationCours a : affectationRepository.findAllWithCours()) {
            affectationsParGroupe.computeIfAbsent(a.getGroupe().getId(), k -> new ArrayList<>()).add(a);
        }

        List<Groupe> tous = coursId != null
                ? groupeRepository.findAllWithEtudiants().stream()
                        .filter(g -> (g.getCours() != null && g.getCours().getId().equals(coursId))
                                || affectationsParGroupe.getOrDefault(g.getId(), List.of()).stream()
                                        .anyMatch(a -> a.getCours().getId().equals(coursId)))
                        .sorted(Comparator.comparing(Groupe::getNom))
                        .toList()
                : groupeRepository.findAllWithEtudiants().stream()
                        .sorted(Comparator.comparing(Groupe::getNom))
                        .toList();

        int from = Math.min(page * size, tous.size());
        int to = Math.min(from + size, tous.size());
        List<GroupeDTO> contenu = tous.subList(from, to).stream()
                .map(g -> mapToDTO(g, affectationsParGroupe.getOrDefault(g.getId(), List.of())))
                .collect(Collectors.toList());
        return new PageResponse<>(
                contenu, page, size, tous.size(), (int) Math.ceil(tous.size() / (double) size), page == 0, to >= tous.size());
    }

    @Override
    @Transactional
    public void supprimer(Long id) {
        Groupe groupe = getEntity(id);
        if (seanceRepository.existsByGroupeId(id)) {
            throw new ConflictException("Le groupe « " + groupe.getNom()
                    + " » est utilisé par des séances de l'emploi du temps : déplanifiez-les d'abord.");
        }
        // Supprimer les inscriptions générées par ce groupe (source = GROUPE)
        List<Inscription> inscriptionsGroupe = inscriptionRepository.findByGroupeIdAndSource(id, Inscription.SOURCE_GROUPE);
        if (!inscriptionsGroupe.isEmpty()) {
            inscriptionRepository.deleteAll(inscriptionsGroupe);
        }
        affectationRepository.deleteAll(affectationRepository.findByGroupeIdWithCours(id));
        groupeRepository.delete(groupe);
    }

    @Override
    @Transactional
    public EtudiantDTO ajouterEtudiant(Long groupeId, EtudiantDTO etudiant) {
        if (etudiant == null || etudiant.getEtudiantId() == null) {
            throw new BusinessException("L'identifiant de l'étudiant est requis.");
        }
        if (etudiant.getNom() == null || etudiant.getNom().isBlank()) {
            throw new BusinessException("Le nom de l'étudiant est requis.");
        }

        Groupe groupe = groupeRepository.findByIdWithEtudiants(groupeId)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + groupeId));

        boolean dejaMembre = groupe.getEtudiants().stream()
                .anyMatch(e -> e.getEtudiantId().equals(etudiant.getEtudiantId()));
        if (dejaMembre) {
            throw new ConflictException("L'étudiant « " + etudiant.getNom().trim()
                    + " » fait déjà partie de la classe « " + groupe.getNom() + " ».");
        }

        if (groupe.getEtudiants().size() >= groupe.getCapacite()) {
            throw new ConflictException("La classe « " + groupe.getNom() + " » est complète ("
                    + groupe.getCapacite() + " places) : augmentez sa capacité pour ajouter cet étudiant.");
        }

        EtudiantGroupe membre = new EtudiantGroupe();
        membre.setEtudiantId(etudiant.getEtudiantId());
        membre.setNom(etudiant.getNom().trim());
        membre.setGroupe(groupe);
        groupe.getEtudiants().add(membre);
        groupeRepository.save(groupe);

        // Règle mixte : l'ajout d'un étudiant à un groupe lui crée les inscriptions de tous les cours du groupe
        Set<Cours> coursDuGroupe = new HashSet<>();
        if (groupe.getCours() != null) {
            coursDuGroupe.add(groupe.getCours());
        }
        List<AffectationCours> affectations = affectationRepository.findByGroupeIdWithCours(groupeId);
        for (AffectationCours aff : affectations) {
            if (aff.getCours() != null) {
                coursDuGroupe.add(aff.getCours());
            }
        }

        for (Cours c : coursDuGroupe) {
            Optional<Inscription> existanteOpt = inscriptionRepository.findByCoursIdAndEtudiantId(c.getId(), etudiant.getEtudiantId());
            // Ne pas écraser une inscription libre volontaire déjà validée
            if (existanteOpt.isPresent() && Inscription.SOURCE_LIBRE.equals(existanteOpt.get().getSource())
                    && Inscription.STATUT_VALIDEE.equals(existanteOpt.get().getStatut())) {
                continue;
            }
            Inscription insc = existanteOpt.orElseGet(Inscription::new);
            insc.setCoursId(c.getId());
            insc.setEtudiantId(etudiant.getEtudiantId());
            insc.setSource(Inscription.SOURCE_GROUPE);
            insc.setGroupeId(groupeId);
            insc.setStatut(Inscription.STATUT_VALIDEE);
            if (insc.getDateDemande() == null) {
                insc.setDateDemande(Instant.now());
            }
            insc.setDateDecision(Instant.now());
            Inscription savedInsc = inscriptionRepository.save(insc);
            eventPublisher.publishEvent(new InscriptionCreeeEvent(savedInsc.getId(), c.getId(), etudiant.getEtudiantId(), Inscription.SOURCE_GROUPE, Inscription.STATUT_VALIDEE, groupeId));
        }

        eventPublisher.publishEvent(new EtudiantAjouteAuGroupeEvent(groupeId, etudiant.getEtudiantId(), etudiant.getNom().trim()));
        return new EtudiantDTO(membre.getEtudiantId(), membre.getNom());
    }

    @Override
    @Transactional
    public void retirerEtudiant(Long groupeId, Long etudiantId) {
        Groupe groupe = groupeRepository.findByIdWithEtudiants(groupeId)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + groupeId));

        EtudiantGroupe membre = groupe.getEtudiants().stream()
                .filter(e -> e.getEtudiantId().equals(etudiantId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Étudiant introuvable dans la classe " + groupe.getNom() + " avec l'id : " + etudiantId));
        groupe.getEtudiants().remove(membre);
        groupeRepository.save(groupe);

        // Règle mixte : le retrait supprime SEULEMENT les inscriptions source=GROUPE, JAMAIS les LIBRE
        List<Inscription> aSupprimer = inscriptionRepository.findByEtudiantIdAndGroupeIdAndSource(etudiantId, groupeId, Inscription.SOURCE_GROUPE);
        if (!aSupprimer.isEmpty()) {
            inscriptionRepository.deleteAll(aSupprimer);
        }
    }

    @Override
    @Transactional
    public AffectationDTO affecterCours(Long groupeId, AffectationDTO affectation) {
        if (affectation == null || affectation.getCoursId() == null) {
            throw new BusinessException("L'identifiant du cours est requis.");
        }
        if (affectation.getType() == null) {
            throw new BusinessException("Le type de séance (CM, TD ou TP) est requis.");
        }

        Groupe groupe = groupeRepository.findByIdWithEtudiants(groupeId)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + groupeId));
        Cours cours = getCours(affectation.getCoursId());

        if (affectationRepository.existsByGroupeIdAndCoursId(groupeId, cours.getId())) {
            throw new ConflictException("Le cours « " + sigle(cours) + " » est déjà affecté à la classe « "
                    + groupe.getNom() + " ».");
        }

        // Règle mixte : Contrôle effectif du groupe <= places restantes du cours
        int effectif = groupe.getEtudiants().size();
        long occupees = inscriptionRepository.countByCoursIdAndStatut(cours.getId(), Inscription.STATUT_VALIDEE);
        long placesRestantes = cours.getCapacite() != null ? Math.max(0, cours.getCapacite() - occupees) : Integer.MAX_VALUE;
        if (cours.getCapacite() != null && effectif > placesRestantes) {
            throw new ConflictException("Capacité insuffisante : l'effectif du groupe (" + effectif
                    + " étudiants) dépasse les places restantes du cours (" + placesRestantes
                    + " places disponibles sur " + cours.getCapacite() + ").");
        }

        AffectationCours creee = affecterInterne(groupe, cours, affectation.getType());

        // Règle mixte : l'affectation crée pour chaque étudiant une Inscription validated avec source=GROUPE et groupeId
        for (EtudiantGroupe eg : groupe.getEtudiants()) {
            Optional<Inscription> existingOpt = inscriptionRepository.findByCoursIdAndEtudiantId(cours.getId(), eg.getEtudiantId());
            if (existingOpt.isPresent() && Inscription.SOURCE_LIBRE.equals(existingOpt.get().getSource())
                    && Inscription.STATUT_VALIDEE.equals(existingOpt.get().getStatut())) {
                // Déjà inscrit librement validé, conserver son choix
                continue;
            }
            Inscription insc = existingOpt.orElseGet(Inscription::new);
            insc.setCoursId(cours.getId());
            insc.setEtudiantId(eg.getEtudiantId());
            insc.setSource(Inscription.SOURCE_GROUPE);
            insc.setGroupeId(groupeId);
            insc.setStatut(Inscription.STATUT_VALIDEE);
            if (insc.getDateDemande() == null) {
                insc.setDateDemande(Instant.now());
            }
            insc.setDateDecision(Instant.now());
            Inscription savedInsc = inscriptionRepository.save(insc);
            eventPublisher.publishEvent(new InscriptionCreeeEvent(savedInsc.getId(), cours.getId(), eg.getEtudiantId(), Inscription.SOURCE_GROUPE, Inscription.STATUT_VALIDEE, groupeId));
        }

        eventPublisher.publishEvent(new CoursAffecteAuGroupeEvent(groupeId, cours.getId(), affectation.getType()));
        return mapToAffectationDTO(creee);
    }

    @Override
    @Transactional
    public void retirerCours(Long groupeId, Long coursId) {
        AffectationCours affectation = affectationRepository.findByGroupeIdAndCoursId(groupeId, coursId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cours introuvable parmi les cours affectés de la classe " + groupeId + " avec l'id : " + coursId));
        affectationRepository.delete(affectation);

        // Règle mixte : la désaffectation supprime seulement les inscriptions source=GROUPE, jamais les LIBRE
        List<Inscription> aSupprimer = inscriptionRepository.findByCoursIdAndGroupeIdAndSource(coursId, groupeId, Inscription.SOURCE_GROUPE);
        if (!aSupprimer.isEmpty()) {
            inscriptionRepository.deleteAll(aSupprimer);
        }
    }

    private AffectationCours affecterInterne(Groupe groupe, Cours cours, TypeSeance type) {
        AffectationCours affectation = new AffectationCours();
        affectation.setGroupe(groupe);
        affectation.setCours(cours);
        affectation.setType(type);
        return affectationRepository.save(affectation);
    }

    private String sigle(Cours cours) {
        return cours.getCode() != null && !cours.getCode().isBlank() ? cours.getCode() : cours.getIntitule();
    }

    private Groupe getEntity(Long id) {
        return groupeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + id));
    }

    private Cours getCours(Long coursId) {
        return coursRepository.findById(coursId)
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + coursId));
    }

    private void validerCapacite(Cours cours, Integer capacite) {
        if (cours.getCapacite() != null && capacite > cours.getCapacite()) {
            throw new BusinessException("La capacité du groupe (" + capacite
                    + ") ne peut pas dépasser celle du cours (" + cours.getCapacite() + ").");
        }
    }

    private GroupeDTO mapToDTO(Groupe groupe, List<AffectationCours> affectations) {
        Long coursId = groupe.getCours() != null ? groupe.getCours().getId() : null;
        GroupeDTO dto = new GroupeDTO(groupe.getId(), groupe.getNom(), groupe.getType(),
                coursId, groupe.getCapacite());
        if (groupe.getCours() != null) {
            dto.setCoursCode(groupe.getCours().getCode());
            dto.setCoursIntitule(groupe.getCours().getIntitule());
        }
        dto.setEffectif(groupe.getEtudiants().size());
        dto.setEtudiants(groupe.getEtudiants().stream()
                .map(e -> new EtudiantDTO(e.getEtudiantId(), e.getNom()))
                .collect(Collectors.toList()));

        if (!affectations.isEmpty() || groupe.getCours() != null) {
            List<AffectationDTO> dtos = new ArrayList<>();
            boolean principalPresent = groupe.getCours() != null && affectations.stream()
                    .anyMatch(a -> a.getCours().getId() != null && a.getCours().getId().equals(groupe.getCours().getId()));
            for (AffectationCours a : affectations) {
                dtos.add(mapToAffectationDTO(a));
            }
            if (groupe.getCours() != null && !principalPresent) {
                dtos.add(mapCoursToAffectationDTO(groupe.getCours(), groupe.getType()));
            }
            dto.setAffectations(dtos);
        } else {
            dto.setAffectations(List.of());
        }
        return dto;
    }

    private AffectationDTO mapToAffectationDTO(AffectationCours affectation) {
        return mapCoursToAffectationDTO(affectation.getCours(), affectation.getType());
    }

    private AffectationDTO mapCoursToAffectationDTO(Cours cours, TypeSeance type) {
        AffectationDTO dto = new AffectationDTO(cours.getId(), type);
        dto.setCoursCode(cours.getCode());
        dto.setCoursIntitule(cours.getIntitule());
        dto.setEnseignantNom(cours.getEnseignantNom());
        return dto;
    }
}
