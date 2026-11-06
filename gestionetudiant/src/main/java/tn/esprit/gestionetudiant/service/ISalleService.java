package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SalleDTO;

public interface ISalleService {

    SalleDTO creer(SalleDTO dto);

    SalleDTO modifier(Long id, SalleDTO dto);

    SalleDTO consulterParId(Long id);

    /** Liste paginée, filtrable par nom. */
    PageResponse<SalleDTO> lister(String nom, int page, int size);

    void supprimer(Long id);
}
