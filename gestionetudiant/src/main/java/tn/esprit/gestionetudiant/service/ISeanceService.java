package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SeanceDTO;
import tn.esprit.gestionetudiant.dto.SeanceRequestDTO;

public interface ISeanceService {

    SeanceDTO creer(SeanceRequestDTO request);

    SeanceDTO modifier(Long id, SeanceRequestDTO request);

    SeanceDTO consulterParId(Long id);

    /** Liste paginée avec filtres optionnels (tous cumulables). */
    PageResponse<SeanceDTO> lister(Long coursId, Long salleId, Long groupeId,
                                   Long enseignantId, Integer jour, int page, int size);

    void supprimer(Long id);
}
