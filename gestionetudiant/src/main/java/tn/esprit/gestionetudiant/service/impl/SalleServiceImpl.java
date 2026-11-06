package tn.esprit.gestionetudiant.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SalleDTO;
import tn.esprit.gestionetudiant.entity.Salle;
import tn.esprit.gestionetudiant.exception.ConflictException;
import tn.esprit.gestionetudiant.exception.ResourceNotFoundException;
import tn.esprit.gestionetudiant.repository.SalleRepository;
import tn.esprit.gestionetudiant.repository.SeanceRepository;
import tn.esprit.gestionetudiant.service.ISalleService;

@Service
@RequiredArgsConstructor
public class SalleServiceImpl implements ISalleService {

    private final SalleRepository salleRepository;
    private final SeanceRepository seanceRepository;

    @Override
    @Transactional
    public SalleDTO creer(SalleDTO dto) {
        if (salleRepository.existsByNomIgnoreCase(dto.getNom())) {
            throw new ConflictException("Une salle nommée « " + dto.getNom() + " » existe déjà.");
        }
        return mapToDTO(salleRepository.save(mapToEntity(dto, new Salle())));
    }

    @Override
    @Transactional
    public SalleDTO modifier(Long id, SalleDTO dto) {
        Salle salle = getEntity(id);
        if (salleRepository.existsByNomIgnoreCaseAndIdNot(dto.getNom(), id)) {
            throw new ConflictException("Une salle nommée « " + dto.getNom() + " » existe déjà.");
        }
        return mapToDTO(salleRepository.save(mapToEntity(dto, salle)));
    }

    @Override
    @Transactional(readOnly = true)
    public SalleDTO consulterParId(Long id) {
        return mapToDTO(getEntity(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SalleDTO> lister(String nom, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "nom"));
        boolean filtre = nom != null && !nom.isBlank();
        Page<Salle> result = filtre
                ? salleRepository.findByNomContainingIgnoreCase(nom.trim(), pageable)
                : salleRepository.findAll(pageable);
        return PageResponse.from(result.map(this::mapToDTO));
    }

    @Override
    @Transactional
    public void supprimer(Long id) {
        Salle salle = getEntity(id);
        if (seanceRepository.existsBySalleId(id)) {
            throw new ConflictException("La salle « " + salle.getNom()
                    + " » est utilisée par des séances de l'emploi du temps : déplanifiez-les d'abord.");
        }
        salleRepository.delete(salle);
    }

    private Salle getEntity(Long id) {
        return salleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Salle introuvable avec l'id : " + id));
    }

    private Salle mapToEntity(SalleDTO dto, Salle salle) {
        salle.setNom(dto.getNom().trim());
        salle.setBatiment(dto.getBatiment() != null ? dto.getBatiment().trim() : null);
        salle.setCapacite(dto.getCapacite());
        return salle;
    }

    private SalleDTO mapToDTO(Salle salle) {
        return new SalleDTO(salle.getId(), salle.getNom(), salle.getBatiment(), salle.getCapacite());
    }
}
