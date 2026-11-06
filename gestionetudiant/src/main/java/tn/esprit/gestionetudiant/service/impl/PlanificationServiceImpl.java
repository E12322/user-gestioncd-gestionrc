package tn.esprit.gestionetudiant.service.impl;

import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.dto.EmploiDuTempsDTO;
import tn.esprit.gestionetudiant.entity.Cours;
import tn.esprit.gestionetudiant.entity.EmploiDuTemps;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.CoursRepository;
import tn.esprit.gestionetudiant.repository.EmploiDuTempsRepository;
import tn.esprit.gestionetudiant.service.IPlanification;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
@AllArgsConstructor
@Service
public class PlanificationServiceImpl implements IPlanification {

    private final EmploiDuTempsRepository emploiDuTempsRepository;
    private final CoursRepository coursRepository;

    @Override
    @Transactional
    public EmploiDuTempsDTO creerEmploiDuTemps(EmploiDuTempsDTO dto) {
        EmploiDuTemps emploiDuTemps = new EmploiDuTemps();
        emploiDuTemps.setTitre(dto.getTitre());
        emploiDuTemps.setSemestre(dto.getSemestre());

        EmploiDuTemps saved = emploiDuTempsRepository.save(emploiDuTemps);
        return mapToDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmploiDuTempsDTO> consulterEmploiDuTemps(Long utilisateurId) {
        List<EmploiDuTemps> list;
        if (utilisateurId != null) {
            list = emploiDuTempsRepository.findByEnseignantId(utilisateurId);
            if (list.isEmpty()) {
                list = emploiDuTempsRepository.findAll();
            }
        } else {
            list = emploiDuTempsRepository.findAll();
        }
        return list.stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public EmploiDuTempsDTO consulterEmploiDuTempsParId(Long id) {
        EmploiDuTemps edt = emploiDuTempsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Emploi du temps introuvable avec l'id : " + id));
        return mapToDTO(edt);
    }

    @Override
    @Transactional
    public void associerCoursAEmploiDuTemps(Long emploiDuTempsId, Long coursId) {
        EmploiDuTemps edt = emploiDuTempsRepository.findById(emploiDuTempsId)
                .orElseThrow(() -> new ResourceNotFoundException("Emploi du temps introuvable avec l'id : " + emploiDuTempsId));
        Cours cours = coursRepository.findById(coursId)
                .orElseThrow(() -> new ResourceNotFoundException("Cours introuvable avec l'id : " + coursId));

        cours.setEmploiDuTemps(edt);
        coursRepository.save(cours);
    }

    private EmploiDuTempsDTO mapToDTO(EmploiDuTemps edt) {
        List<CoursDTO> coursDTOs = new ArrayList<>();
        if (edt.getCoursList() != null) {
            for (Cours c : edt.getCoursList()) {
                CoursDTO cdto = new CoursDTO();
                cdto.setId(c.getId());
                cdto.setIntitule(c.getIntitule());
                cdto.setEnseignantId(c.getEnseignantId());
                if (c.getEnseignantId() != null) {
                    cdto.setEnseignantNom("Enseignant #" + c.getEnseignantId());
                }
                cdto.setEmploiDuTempsId(edt.getId());
                coursDTOs.add(cdto);
            }
        }

        EmploiDuTempsDTO dto = new EmploiDuTempsDTO();
        dto.setId(edt.getId());
        dto.setTitre(edt.getTitre());
        dto.setSemestre(edt.getSemestre());
        dto.setCours(coursDTOs);
        return dto;
    }
}
