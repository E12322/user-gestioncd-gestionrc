package tn.esprit.gestionetudiant.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AnneeAcademiqueDTO;
import tn.esprit.gestionetudiant.entity.AnneeAcademique;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.AnneeAcademiqueRepository;
import tn.esprit.gestionetudiant.service.IAnneeAcademiqueService;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class AnneeAcademiqueServiceImpl implements IAnneeAcademiqueService {

    private final AnneeAcademiqueRepository anneeAcademiqueRepository;

    @Override
    @Transactional
    public AnneeAcademiqueDTO creer(AnneeAcademiqueDTO dto) {
        validerPeriode(dto.getDateDebut(), dto.getDateFin());

        if (anneeAcademiqueRepository.existsByLibelleIgnoreCase(dto.getLibelle())) {
            throw new ConflictException("L'année académique « " + dto.getLibelle() + " » existe déjà.");
        }

        AnneeAcademique annee = new AnneeAcademique();
        annee.setLibelle(dto.getLibelle().trim());
        annee.setDateDebut(dto.getDateDebut());
        annee.setDateFin(dto.getDateFin());
        if (dto.isActive()) {
            anneeAcademiqueRepository.deactivateAll();
            annee.setActive(true);
        }

        return mapToDTO(anneeAcademiqueRepository.save(annee));
    }

    @Override
    @Transactional
    public AnneeAcademiqueDTO modifier(Long id, AnneeAcademiqueDTO dto) {
        AnneeAcademique annee = anneeAcademiqueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Année académique introuvable avec l'id : " + id));

        validerPeriode(dto.getDateDebut(), dto.getDateFin());
        if (anneeAcademiqueRepository.existsByLibelleIgnoreCaseAndIdNot(dto.getLibelle(), id)) {
            throw new ConflictException("L'année académique « " + dto.getLibelle() + " » existe déjà.");
        }

        annee.setLibelle(dto.getLibelle().trim());
        annee.setDateDebut(dto.getDateDebut());
        annee.setDateFin(dto.getDateFin());

        if (dto.isActive() && !annee.isActive()) {
            anneeAcademiqueRepository.deactivateAll();
            annee.setActive(true);
        } else {
            annee.setActive(dto.isActive());
        }

        return mapToDTO(anneeAcademiqueRepository.save(annee));
    }

    @Override
    @Transactional(readOnly = true)
    public AnneeAcademiqueDTO consulterParId(Long id) {
        return mapToDTO(getEntity(id));
    }

    @Override
    @Transactional(readOnly = true)
    public AnneeAcademiqueDTO consulterAnneeActive() {
        return anneeAcademiqueRepository.findFirstByActiveTrue()
                .map(this::mapToDTO)
                .orElseThrow(() -> new ResourceNotFoundException("Aucune année académique active n'est définie."));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AnneeAcademiqueDTO> lister(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "dateDebut"));
        Page<AnneeAcademiqueDTO> result = anneeAcademiqueRepository.findAll(pageable).map(this::mapToDTO);
        return PageResponse.from(result);
    }

    @Override
    @Transactional
    public void supprimer(Long id) {
        AnneeAcademique annee = getEntity(id);
        if (annee.isActive()) {
            throw new BusinessException("Impossible de supprimer l'année académique active : activez d'abord une autre année.");
        }
        anneeAcademiqueRepository.delete(annee);
    }

    private AnneeAcademique getEntity(Long id) {
        return anneeAcademiqueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Année académique introuvable avec l'id : " + id));
    }

    private void validerPeriode(LocalDate debut, LocalDate fin) {
        if (!debut.isBefore(fin)) {
            throw new BusinessException("La date de début de l'année académique doit être antérieure à sa date de fin.");
        }
    }

    private AnneeAcademiqueDTO mapToDTO(AnneeAcademique annee) {
        return new AnneeAcademiqueDTO(annee.getId(), annee.getLibelle(), annee.getDateDebut(),
                annee.getDateFin(), annee.isActive());
    }
}
