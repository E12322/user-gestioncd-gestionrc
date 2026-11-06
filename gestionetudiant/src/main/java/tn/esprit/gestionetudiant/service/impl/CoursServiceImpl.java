package tn.esprit.gestionetudiant.service.impl;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.dto.DocumentDTO;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.DocumentCours;
import tn.esprit.gestionetudiant.entity.EmploiDuTemps;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.EmploiDuTempsRepository;
import tn.esprit.gestionetudiant.service.IAuthentification;
import tn.esprit.gestionetudiant.service.ICoursService;

import java.util.List;
import java.util.stream.Collectors;

@AllArgsConstructor
@Service
public class CoursServiceImpl implements ICoursService {

    private final CoursRepository coursRepository;
    private final EmploiDuTempsRepository emploiDuTempsRepository;
    private final IAuthentification authentificationService;

    @Override
    @Transactional
    public CoursDTO creerCours(CoursDTO coursDTO) {
        Cours cours = new Cours();
        copyFieldsFromDTO(coursDTO, cours);

        if (coursDTO.getEnseignantId() != null) {
            if (!authentificationService.verifierRoleEnseignant(coursDTO.getEnseignantId())) {
                throw new BusinessException("L'utilisateur assigné doit avoir le rôle ENSEIGNANT dans le microservice Utilisateurs.");
            }
            cours.setEnseignantId(coursDTO.getEnseignantId());
        }

        if (coursDTO.getEmploiDuTempsId() != null) {
            EmploiDuTemps edt = emploiDuTempsRepository.findById(coursDTO.getEmploiDuTempsId())
                    .orElseThrow(() -> new ResourceNotFoundException("Emploi du temps introuvable"));
            cours.setEmploiDuTemps(edt);
        }

        remplacerDocuments(cours, coursDTO.getDocuments());

        Cours savedCours = coursRepository.save(cours);
        return mapToDTO(savedCours);
    }

    @Override
    @Transactional
    public CoursDTO modifierCours(Long id, CoursDTO coursDTO) {
        Cours cours = coursRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + id));

        copyFieldsFromDTO(coursDTO, cours);

        if (coursDTO.getEnseignantId() != null) {
            if (!authentificationService.verifierRoleEnseignant(coursDTO.getEnseignantId())) {
                throw new BusinessException("L'utilisateur assigné doit avoir le rôle ENSEIGNANT dans le microservice Utilisateurs.");
            }
            cours.setEnseignantId(coursDTO.getEnseignantId());
        }

        if (coursDTO.getEmploiDuTempsId() != null) {
            EmploiDuTemps edt = emploiDuTempsRepository.findById(coursDTO.getEmploiDuTempsId())
                    .orElseThrow(() -> new ResourceNotFoundException("Emploi du temps introuvable"));
            cours.setEmploiDuTemps(edt);
        }

        // Remplacement en bloc des supports (orphanRemoval supprime les anciens) ; ignoré si le champ est absent.
        if (coursDTO.getDocuments() != null) {
            remplacerDocuments(cours, coursDTO.getDocuments());
        }

        Cours updated = coursRepository.save(cours);
        return mapToDTO(updated);
    }

    @Override
    @Transactional
    public void supprimerCours(Long id) {
        if (!coursRepository.existsById(id)) {
            throw new ResourceNotFoundException("Cours introuvable avec l'id : " + id);
        }
        coursRepository.deleteById(id);
    }

    @Override
    @Transactional
    public CoursDTO affecterEnseignant(Long coursId, Long enseignantId) {
        if (!authentificationService.verifierRoleEnseignant(enseignantId)) {
            throw new BusinessException("Règle métier : Seul un utilisateur avec le rôle ENSEIGNANT peut être affecté à un cours.");
        }

        Cours cours = coursRepository.findById(coursId)
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + coursId));

        cours.setEnseignantId(enseignantId);

        Cours updated = coursRepository.save(cours);
        return mapToDTO(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public CoursDTO consulterCoursParId(Long id) {
        Cours cours = coursRepository.findByIdWithDocuments(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + id));
        return mapToDTO(cours);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CoursDTO> consulterTousLesCours() {
        return coursRepository.findAllWithDocuments()
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    private void copyFieldsFromDTO(CoursDTO dto, Cours cours) {
        if (dto.getCode() != null) cours.setCode(dto.getCode());
        if (dto.getIntitule() != null) cours.setIntitule(dto.getIntitule());
        if (dto.getDepartement() != null) cours.setDepartement(dto.getDepartement());
        if (dto.getCredits() != null) cours.setCredits(dto.getCredits());
        if (dto.getSemestre() != null) cours.setSemestre(dto.getSemestre());
        if (dto.getEnseignantNom() != null) cours.setEnseignantNom(dto.getEnseignantNom());
        if (dto.getCapacite() != null) cours.setCapacite(dto.getCapacite());
        if (dto.getNature() != null && !dto.getNature().isBlank()) {
            cours.setNature(dto.getNature().trim().toUpperCase());
        } else if (cours.getNature() == null) {
            cours.setNature("OBLIGATOIRE");
        }
        if (dto.getDescription() != null) cours.setDescription(dto.getDescription());
        if (dto.getContenu() != null) cours.setContenu(dto.getContenu());

        // Supports Vidéo
        if (dto.getVideoTitre() != null) cours.setVideoTitre(dto.getVideoTitre());
        if (dto.getVideoUrl() != null) cours.setVideoUrl(dto.getVideoUrl());
        if (dto.getVideoNomFichier() != null) cours.setVideoNomFichier(dto.getVideoNomFichier());
        if (dto.getVideoTaille() != null) cours.setVideoTaille(dto.getVideoTaille());
        if (dto.getVideoFormat() != null) cours.setVideoFormat(dto.getVideoFormat());

        // Supports Document PDF
        if (dto.getDocumentTitre() != null) cours.setDocumentTitre(dto.getDocumentTitre());
        if (dto.getDocumentUrl() != null) cours.setDocumentUrl(dto.getDocumentUrl());
        if (dto.getDocumentNomFichier() != null) cours.setDocumentNomFichier(dto.getDocumentNomFichier());
        if (dto.getDocumentTaille() != null) cours.setDocumentTaille(dto.getDocumentTaille());
        if (dto.getDocumentFormat() != null) cours.setDocumentFormat(dto.getDocumentFormat());
    }

    /**
     * Remplace la liste des supports pédagogiques du cours par celle du DTO.
     * Chaque support est rattaché au cours (cascade PERSIST à la sauvegarde) ;
     * les supports retirés de la liste sont supprimés (orphanRemoval).
     */
    private void remplacerDocuments(Cours cours, List<DocumentDTO> documents) {
        cours.getDocuments().clear();
        if (documents == null) {
            return;
        }
        for (DocumentDTO d : documents) {
            DocumentCours doc = new DocumentCours();
            doc.setTitre(d.getTitre() != null && !d.getTitre().isBlank() ? d.getTitre()
                    : (d.getNomFichier() != null ? d.getNomFichier() : "Support"));
            doc.setUrl(d.getUrl());
            doc.setNomFichier(d.getNomFichier());
            doc.setTaille(d.getTaille());
            doc.setFormat(d.getFormat());
            doc.setCours(cours);
            cours.getDocuments().add(doc);
        }
    }

    private CoursDTO mapToDTO(Cours cours) {
        CoursDTO dto = new CoursDTO();
        dto.setId(cours.getId());
        dto.setCode(cours.getCode());
        dto.setIntitule(cours.getIntitule());
        dto.setDepartement(cours.getDepartement());
        dto.setCredits(cours.getCredits());
        dto.setSemestre(cours.getSemestre());
        dto.setEnseignantId(cours.getEnseignantId());
        dto.setEnseignantNom(cours.getEnseignantNom() != null ? cours.getEnseignantNom() : (cours.getEnseignantId() != null ? "Enseignant #" + cours.getEnseignantId() : null));
        dto.setCapacite(cours.getCapacite());
        dto.setNature(cours.getNature() != null ? cours.getNature() : "OBLIGATOIRE");
        dto.setDescription(cours.getDescription());
        dto.setContenu(cours.getContenu());

        // Supports Vidéo
        dto.setVideoTitre(cours.getVideoTitre());
        dto.setVideoUrl(cours.getVideoUrl());
        dto.setVideoNomFichier(cours.getVideoNomFichier());
        dto.setVideoTaille(cours.getVideoTaille());
        dto.setVideoFormat(cours.getVideoFormat());

        // Supports Document PDF
        dto.setDocumentTitre(cours.getDocumentTitre());
        dto.setDocumentUrl(cours.getDocumentUrl());
        dto.setDocumentNomFichier(cours.getDocumentNomFichier());
        dto.setDocumentTaille(cours.getDocumentTaille());
        dto.setDocumentFormat(cours.getDocumentFormat());

        // Liste persistée des supports pédagogiques (PDF, PPTX, DOCX, ZIP, vidéo...)
        if (cours.getDocuments() != null) {
            dto.setDocuments(cours.getDocuments().stream()
                    .map(d -> new DocumentDTO(d.getId(), d.getTitre(), d.getUrl(), d.getNomFichier(), d.getTaille(), d.getFormat()))
                    .collect(Collectors.toList()));
        }

        if (cours.getEmploiDuTemps() != null) {
            dto.setEmploiDuTempsId(cours.getEmploiDuTemps().getId());
        }
        return dto;
    }
}
