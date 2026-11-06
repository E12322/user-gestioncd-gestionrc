package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AffectationDTO;
import tn.esprit.gestionetudiant.dto.EtudiantDTO;
import tn.esprit.gestionetudiant.dto.GroupeDTO;

public interface IGroupeService {

    GroupeDTO creer(GroupeDTO dto);

    GroupeDTO modifier(Long id, GroupeDTO dto);

    GroupeDTO consulterParId(Long id);

    /** Liste paginée, filtrable par cours. */
    PageResponse<GroupeDTO> lister(Long coursId, int page, int size);

    void supprimer(Long id);

    /** Ajoute un étudiant à la classe (capacité et doublon contrôlés). */
    EtudiantDTO ajouterEtudiant(Long groupeId, EtudiantDTO etudiant);

    /** Retire un étudiant de la classe. */
    void retirerEtudiant(Long groupeId, Long etudiantId);

    /** Affecte un cours à la classe avec son type de séance (CM/TD/TP). */
    AffectationDTO affecterCours(Long groupeId, AffectationDTO affectation);

    /** Retire un cours des cours affectés de la classe. */
    void retirerCours(Long groupeId, Long coursId);
}
