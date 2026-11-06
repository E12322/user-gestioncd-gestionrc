package tn.esprit.gestionetudiant.controller;

import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.dto.EmploiDuTempsDTO;
import tn.esprit.gestionetudiant.service.IPlanification;

import java.util.List;
@AllArgsConstructor
@RestController
@RequestMapping({"/planifications", "/api/academic/v1/planifications"})
public class PlanificationController {

    private  IPlanification planificationService;

    @PostMapping("/emplois-du-temps")
    public ResponseEntity<EmploiDuTempsDTO> creerEmploiDuTemps(@RequestBody EmploiDuTempsDTO dto) {
        EmploiDuTempsDTO created = planificationService.creerEmploiDuTemps(dto);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping("/emplois-du-temps")
    public ResponseEntity<List<EmploiDuTempsDTO>> consulterEmploiDuTemps(
            @RequestParam(required = false) Long utilisateurId) {
        return ResponseEntity.ok(planificationService.consulterEmploiDuTemps(utilisateurId));
    }

    @GetMapping("/emplois-du-temps/{id}")
    public ResponseEntity<EmploiDuTempsDTO> consulterEmploiDuTempsParId(@PathVariable Long id) {
        return ResponseEntity.ok(planificationService.consulterEmploiDuTempsParId(id));
    }

    @PostMapping("/emplois-du-temps/{id}/cours/{coursId}")
    public ResponseEntity<Void> associerCours(
            @PathVariable Long id,
            @PathVariable Long coursId) {
        planificationService.associerCoursAEmploiDuTemps(id, coursId);
        return ResponseEntity.ok().build();
    }
}
