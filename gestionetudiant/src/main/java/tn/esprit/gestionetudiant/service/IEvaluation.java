package tn.esprit.gestionetudiant.service;

import tn.esprit.gestionetudiant.dto.AbsenceRequestDTO;
import tn.esprit.gestionetudiant.dto.AbsenceResponseDTO;
import tn.esprit.gestionetudiant.dto.NoteRequestDTO;
import tn.esprit.gestionetudiant.dto.NoteResponseDTO;

import java.util.List;

/**
 * Interface pour la gestion des évaluations (Notes et Absences).
 * Conforme au diagramme UML du module NotesEtAbsences.
 */
public interface IEvaluation {

    NoteResponseDTO saisirNote(NoteRequestDTO request);

    NoteResponseDTO modifierNote(Long noteId, float nouvelleValeur, Long enseignantId);

    List<NoteResponseDTO> consulterNotes(Long etudiantId);

    /** Notes de tous les étudiants pour un cours (vue enseignant/admin). */
    List<NoteResponseDTO> consulterNotesParCours(Long coursId);

    /** Toutes les notes enregistrées dans le système (vue consolidée résultats / admin). */
    List<NoteResponseDTO> listerToutesNotes();

    float calculerMoyenne(Long etudiantId);

    AbsenceResponseDTO enregistrerAbsence(AbsenceRequestDTO request);

    List<AbsenceResponseDTO> consulterAbsences(Long etudiantId);

    /** Absences filtrables par cours et/ou étudiant (aucun filtre = toutes). */
    List<AbsenceResponseDTO> listerAbsences(Long coursId, Long etudiantId);

    boolean notifierSeuilDepasse(Long etudiantId, Long coursId);

    void supprimerAbsence(Long id);

    AbsenceResponseDTO justifierAbsence(Long id, boolean justifiee);
}
