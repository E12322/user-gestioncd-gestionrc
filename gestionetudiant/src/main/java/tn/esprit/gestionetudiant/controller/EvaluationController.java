package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.dto.AbsenceRequestDTO;
import tn.esprit.gestionetudiant.dto.AbsenceResponseDTO;
import tn.esprit.gestionetudiant.dto.NoteRequestDTO;
import tn.esprit.gestionetudiant.dto.NoteResponseDTO;
import tn.esprit.gestionetudiant.service.IEvaluation;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
@AllArgsConstructor
@RestController

@RequestMapping({"/evaluations", "/api/academic/v1/evaluations"})
public class EvaluationController {

    private  IEvaluation evaluationService;

    @PostMapping("/notes")
    public NoteResponseDTO saisirNote(@Valid @RequestBody NoteRequestDTO request) {
       return evaluationService.saisirNote(request);

    }

    @PutMapping("/notes/{id}")
    public NoteResponseDTO modifierNote(
            @PathVariable Long id,
            @RequestParam float valeur,
            @RequestParam Long enseignantId) {
       return evaluationService.modifierNote(id, valeur, enseignantId);

    }

    @GetMapping("/notes/etudiant/{etudiantId}")
    public List<NoteResponseDTO> consulterNotes(@PathVariable Long etudiantId) {
        return evaluationService.consulterNotes(etudiantId);
    }

    @GetMapping("/notes/etudiant/{etudiantId}/moyenne")
    public ResponseEntity<Map<String, Object>> calculerMoyenne(@PathVariable Long etudiantId) {
        float moyenne = evaluationService.calculerMoyenne(etudiantId);
        Map<String, Object> result = new HashMap<>();
        result.put("etudiantId", etudiantId);
        result.put("moyenne", moyenne);
        return ResponseEntity.ok(result);
    }

    /** Notes de tout un cours (vue enseignant : saisie des notes d'un cours). */
    @GetMapping("/notes/cours/{coursId}")
    public List<NoteResponseDTO> consulterNotesParCours(@PathVariable Long coursId) {
        return evaluationService.consulterNotesParCours(coursId);
    }

    /** Toutes les notes du système (vue consolidée résultats / admin). */
    @GetMapping("/notes")
    public List<NoteResponseDTO> listerToutesNotes() {
        return evaluationService.listerToutesNotes();
    }

    /**
     * Absences filtrables : /absences (toutes), /absences?coursId=5,
     * /absences?etudiantId=42 ou les deux combinés.
     */
    @GetMapping("/absences")
    public List<AbsenceResponseDTO> listerAbsences(
            @RequestParam(required = false) Long coursId,
            @RequestParam(required = false) Long etudiantId) {
        return evaluationService.listerAbsences(coursId, etudiantId);
    }

    @PostMapping("/absences")
    public AbsenceResponseDTO enregistrerAbsence(@Valid @RequestBody AbsenceRequestDTO request) {
     return evaluationService.enregistrerAbsence(request);

    }

    @GetMapping("/absences/etudiant/{etudiantId}")
    public List<AbsenceResponseDTO> consulterAbsences(@PathVariable Long etudiantId) {
        return evaluationService.consulterAbsences(etudiantId);
    }

    @GetMapping("/absences/alerte")
    public ResponseEntity<Map<String, Object>> notifierSeuilDepasse(
            @RequestParam Long etudiantId,
            @RequestParam Long coursId) {
        boolean depasse = evaluationService.notifierSeuilDepasse(etudiantId, coursId);
        Map<String, Object> result = new HashMap<>();
        result.put("etudiantId", etudiantId);
        result.put("coursId", coursId);
        result.put("seuilDepasse", depasse);
        result.put("alerte", depasse ? "Seuil d'absences dépassé pour ce cours !" : "Seuil dans la limite autorisée.");
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/absences/{id}")
    public ResponseEntity<Void> supprimerAbsence(@PathVariable Long id) {
        evaluationService.supprimerAbsence(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/absences/{id}/justifier")
    public AbsenceResponseDTO justifierAbsence(@PathVariable Long id, @RequestParam boolean justifiee) {
        return evaluationService.justifierAbsence(id, justifiee);
    }
}
