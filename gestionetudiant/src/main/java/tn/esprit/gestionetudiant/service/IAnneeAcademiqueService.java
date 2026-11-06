package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AnneeAcademiqueDTO;

public interface IAnneeAcademiqueService {

    AnneeAcademiqueDTO creer(AnneeAcademiqueDTO dto);

    AnneeAcademiqueDTO modifier(Long id, AnneeAcademiqueDTO dto);

    AnneeAcademiqueDTO consulterParId(Long id);

    /** Retourne l'année académique active (unique). */
    AnneeAcademiqueDTO consulterAnneeActive();

    PageResponse<AnneeAcademiqueDTO> lister(int page, int size);

    void supprimer(Long id);
}
