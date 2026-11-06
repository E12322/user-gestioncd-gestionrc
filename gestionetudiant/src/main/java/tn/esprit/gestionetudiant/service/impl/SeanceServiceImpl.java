package tn.esprit.gestionetudiant.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SeanceDTO;
import tn.esprit.gestionetudiant.dto.SeanceRequestDTO;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.Groupe;
import tn.esprit.gestionetudiant.entity.Salle;
import tn.esprit.gestionetudiant.entity.Seance;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.AffectationCoursRepository;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.GroupeRepository;
import tn.esprit.gestionetudiant.repository.SalleRepository;
import tn.esprit.gestionetudiant.repository.SeanceRepository;
import tn.esprit.gestionetudiant.service.IAuthentification;
import tn.esprit.gestionetudiant.service.ISeanceService;

import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SeanceServiceImpl implements ISeanceService {

    private final SeanceRepository seanceRepository;
    private final CoursRepository coursRepository;
    private final SalleRepository salleRepository;
    private final GroupeRepository groupeRepository;
    private final AffectationCoursRepository affectationCoursRepository;
    private final IAuthentification authentificationService;

    @Override
    @Transactional
    public SeanceDTO creer(SeanceRequestDTO request) {
        Seance seance = buildEntity(request, new Seance());
        detecterConflit(seance, -1L);
        return mapToDTO(seanceRepository.save(seance));
    }

    @Override
    @Transactional
    public SeanceDTO modifier(Long id, SeanceRequestDTO request) {
        Seance seance = getEntity(id);
        buildEntity(request, seance);
        detecterConflit(seance, id);
        return mapToDTO(seanceRepository.save(seance));
    }

    @Override
    @Transactional(readOnly = true)
    public SeanceDTO consulterParId(Long id) {
        return mapToDTO(getEntity(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SeanceDTO> lister(Long coursId, Long salleId, Long groupeId,
                                          Long enseignantId, Integer jour, int page, int size) {
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.ASC, "jour").and(Sort.by(Sort.Direction.ASC, "heureDebut")));
        Page<SeanceDTO> result = seanceRepository
                .search(coursId, salleId, groupeId, enseignantId, jour, pageable)
                .map(this::mapToDTO);
        return PageResponse.from(result);
    }

    @Override
    @Transactional
    public void supprimer(Long id) {
        seanceRepository.delete(getEntity(id));
    }

    private Seance getEntity(Long id) {
        return seanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Séance introuvable avec l'id : " + id));
    }

    /** Valide la requête et charge les entités référencées. */
    private Seance buildEntity(SeanceRequestDTO request, Seance seance) {
        validerHoraire(request.getHeureDebut(), request.getHeureFin());

        Cours cours = coursRepository.findById(request.getCoursId())
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + request.getCoursId()));
        Salle salle = salleRepository.findById(request.getSalleId())
                .orElseThrow(() -> new ResourceNotFoundException("Salle introuvable avec l'id : " + request.getSalleId()));

        Groupe groupe = null;
        if (request.getGroupeId() != null) {
            groupe = groupeRepository.findById(request.getGroupeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable avec l'id : " + request.getGroupeId()));
            // La classe doit suivre le cours : soit cours principal, soit cours affecté (fiche « Cours affectés »).
            boolean suitCours = groupe.getCours().getId().equals(cours.getId())
                    || affectationCoursRepository.existsByGroupeIdAndCoursId(groupe.getId(), cours.getId());
            if (!suitCours) {
                throw new BusinessException("Le groupe « " + groupe.getNom()
                        + " » n'appartient pas au cours « " + cours.getIntitule() + " ».");
            }
        }

        Long ensId = request.getEnseignantId() != null ? request.getEnseignantId() : (cours.getEnseignantId());
        if (ensId != null
                && !authentificationService.verifierRoleEnseignant(ensId)) {
            throw new BusinessException("L'utilisateur assigné à la séance doit avoir le rôle ENSEIGNANT.");
        }

        seance.setCours(cours);
        seance.setSalle(salle);
        seance.setGroupe(groupe);
        seance.setEnseignantId(ensId);
        seance.setType(request.getType());
        seance.setJour(request.getJour());
        seance.setHeureDebut(request.getHeureDebut());
        seance.setHeureFin(request.getHeureFin());
        return seance;
    }

    private void validerHoraire(LocalTime debut, LocalTime fin) {
        if (!debut.isBefore(fin)) {
            throw new BusinessException("L'heure de début de la séance doit être antérieure à l'heure de fin.");
        }
    }

    /**
     * Règle métier : un même créneau ne peut pas être occupé deux fois
     * par la même salle, le même enseignant ou le même groupe.
     */
    private void detecterConflit(Seance seance, long excludeId) {
        List<Seance> conflits = seanceRepository.findConflicting(
                seance.getJour(),
                seance.getHeureDebut(),
                seance.getHeureFin(),
                seance.getSalle().getId(),
                seance.getEnseignantId() != null ? seance.getEnseignantId() : -1L,
                seance.getGroupe() != null ? seance.getGroupe().getId() : -1L,
                excludeId);

        if (conflits.isEmpty()) {
            return;
        }

        Seance autre = conflits.get(0);
        String motif;
        if (autre.getSalle().getId().equals(seance.getSalle().getId())) {
            motif = "la salle " + autre.getSalle().getNom();
        } else if (seance.getEnseignantId() != null && seance.getEnseignantId().equals(autre.getEnseignantId())) {
            motif = "l'enseignant #" + seance.getEnseignantId();
        } else {
            motif = "le groupe « " + autre.getGroupe().getNom() + " »";
        }

        throw new ConflictException(String.format(
                "Conflit d'emploi du temps : le jour %d de %s à %s est déjà occupé par %s (séance du cours « %s »).",
                seance.getJour(), seance.getHeureDebut(), seance.getHeureFin(), motif, autre.getCours().getIntitule()));
    }

    private SeanceDTO mapToDTO(Seance seance) {
        SeanceDTO dto = new SeanceDTO();
        dto.setId(seance.getId());
        dto.setCoursId(seance.getCours().getId());
        dto.setCoursCode(seance.getCours().getCode());
        dto.setCoursIntitule(seance.getCours().getIntitule());
        if (seance.getGroupe() != null) {
            dto.setGroupeId(seance.getGroupe().getId());
            dto.setGroupeNom(seance.getGroupe().getNom());
        }
        dto.setSalleId(seance.getSalle().getId());
        dto.setSalleNom(seance.getSalle().getNom());
        Long ensId = seance.getEnseignantId() != null ? seance.getEnseignantId() : (seance.getCours() != null ? seance.getCours().getEnseignantId() : null);
        dto.setEnseignantId(ensId);
        dto.setEnseignantNom(seance.getCours() != null ? seance.getCours().getEnseignantNom() : null);
        dto.setType(seance.getType());
        dto.setJour(seance.getJour());
        dto.setHeureDebut(seance.getHeureDebut());
        dto.setHeureFin(seance.getHeureFin());
        return dto;
    }
}
