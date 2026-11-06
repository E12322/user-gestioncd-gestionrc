package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.dto.CoursDTO;
import tn.esprit.gestionetudiant.service.ICoursService;

import java.util.List;
@AllArgsConstructor
@RestController
@RequestMapping({"/cours", "/api/academic/v1/courses"})
public class CoursController {

    private ICoursService coursService;

    /** Création : 201 Created. Ancien alias « /create » conservé pour rétro-compatibilité. */
    @PostMapping({"", "/create"})
    @ResponseStatus(HttpStatus.CREATED)
    public CoursDTO creerCours(@Valid @RequestBody CoursDTO coursDTO) {
        return coursService.creerCours(coursDTO);
    }

    @GetMapping({"", "/getAll"})
    public List<CoursDTO> consulterTousLesCours() {
        return coursService.consulterTousLesCours();
    }

    @GetMapping("/{id}")
    public CoursDTO consulterCoursParId(@PathVariable Long id) {
        return coursService.consulterCoursParId(id);
    }

    @PutMapping({"/{id}", "/update/{id}"})
    public CoursDTO modifierCours(@PathVariable Long id, @Valid @RequestBody CoursDTO coursDTO) {
        return coursService.modifierCours(id, coursDTO);
    }

    /** Suppression : 204 No Content. Ancien alias « /delete/{id} » conservé. */
    @DeleteMapping({"/{id}", "/delete/{id}"})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimerCours(@PathVariable Long id) {
        coursService.supprimerCours(id);
    }
    @PutMapping("/{id}/enseignant/{enseignantId}")
    public CoursDTO affecterEnseignant(
            @PathVariable Long id,
            @PathVariable Long enseignantId) {
        return coursService.affecterEnseignant(id, enseignantId);
    }
}
