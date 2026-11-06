package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SeanceDTO;
import tn.esprit.gestionetudiant.dto.SeanceRequestDTO;
import tn.esprit.gestionetudiant.service.ISeanceService;

/**
 * Emploi du temps : séances avec détection de conflits (salle, enseignant, groupe).
 */
@RestController
@RequestMapping("/api/academic/v1/sessions")
@RequiredArgsConstructor
@Validated
public class SeanceController {

    private final ISeanceService seanceService;

    @GetMapping
    public PageResponse<SeanceDTO> lister(
            @RequestParam(required = false) Long coursId,
            @RequestParam(required = false) Long salleId,
            @RequestParam(required = false) Long groupeId,
            @RequestParam(required = false) Long enseignantId,
            @RequestParam(required = false) @Min(1) @Max(6) Integer jour,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return seanceService.lister(coursId, salleId, groupeId, enseignantId, jour, page, size);
    }

    @GetMapping("/{id}")
    public SeanceDTO consulter(@PathVariable Long id) {
        return seanceService.consulterParId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SeanceDTO creer(@Valid @RequestBody SeanceRequestDTO request) {
        return seanceService.creer(request);
    }

    @PutMapping("/{id}")
    public SeanceDTO modifier(@PathVariable Long id, @Valid @RequestBody SeanceRequestDTO request) {
        return seanceService.modifier(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        seanceService.supprimer(id);
    }
}
