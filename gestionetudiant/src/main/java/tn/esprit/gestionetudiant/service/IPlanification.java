package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.dto.EmploiDuTempsDTO;

import java.util.List;

/**
 * Interface pour la planification (Emplois du temps).
 * Conforme au diagramme UML du module CoursEtEmploisDuTemps.
 */
public interface IPlanification {

    EmploiDuTempsDTO creerEmploiDuTemps(EmploiDuTempsDTO dto);

    List<EmploiDuTempsDTO> consulterEmploiDuTemps(Long utilisateurId);

    EmploiDuTempsDTO consulterEmploiDuTempsParId(Long id);

    void associerCoursAEmploiDuTemps(Long emploiDuTempsId, Long coursId);
}
