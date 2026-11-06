package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.dto.CoursDTO;

import java.util.List;

/**
 * Interface pour la gestion des cours.
 * Méthodes du diagramme UML: creerCours, modifierCours, supprimerCours, affecterEnseignant.
 */
public interface ICoursService {

    CoursDTO creerCours(CoursDTO coursDTO);

    CoursDTO modifierCours(Long id, CoursDTO coursDTO);

    void supprimerCours(Long id);

    CoursDTO affecterEnseignant(Long coursId, Long enseignantId);

    CoursDTO consulterCoursParId(Long id);

    List<CoursDTO> consulterTousLesCours();
}
