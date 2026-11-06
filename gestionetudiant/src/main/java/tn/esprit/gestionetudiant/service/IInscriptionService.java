package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.dto.InscriptionResponseDTO;

import java.util.List;

/**
 * Inscriptions aux cours — workflow administrateur :
 * l'étudiant demande (pending), l'admin valide (validated) ou refuse (refused).
 * Les données sont persistées en PostgreSQL (table inscriptions).
 */
public interface IInscriptionService {

    /**
     * Demande d'inscription d'un étudiant à un cours.
     *
     * @throws tn.esprit.gestionetudiant.exception.ResourceNotFoundException cours inconnu
     * @throws tn.esprit.gestionetudiant.exception.ConflictException        doublon (409 ALREADY_ENROLLED)
     *                                                                    ou complet (409 COURSE_FULL)
     */
    InscriptionResponseDTO demander(Long coursId, Long etudiantId);

    /**
     * Liste des inscriptions : un étudiant voit les siennes, un admin/enseignant
     * toutes (filtrables par cours via {@code coursId}).
     */
    List<InscriptionResponseDTO> lister(Long etudiantId, Long coursId);

    /**
     * Décision de l'admin : "validated" ou "refused".
     *
     * @throws tn.esprit.gestionetudiant.exception.ResourceNotFoundException demande inconnue
     * @throws tn.esprit.gestionetudiant.exception.ConflictException         déjà tranchée (409 ALREADY_DECIDED)
     * @throws tn.esprit.gestionetudiant.exception.BusinessException         statut inconnu
     */
    InscriptionResponseDTO decider(Long inscriptionId, String statut);
}
