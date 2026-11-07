package com.smartcampus.ressources.controller;

import com.smartcampus.ressources.dto.SalleRequestDTO;
import com.smartcampus.ressources.dto.SalleResponseDTO;
import com.smartcampus.ressources.service.ISalleService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/internal/salles")
public class SalleController {

    private final ISalleService salleService;

    public SalleController(ISalleService salleService) {
        this.salleService = salleService;
    }

    // BF3.1 : L'administrateur peut créer une salle
    @PostMapping
    public ResponseEntity<SalleResponseDTO> creerSalle(@Valid @RequestBody SalleRequestDTO dto,
                                                      @RequestHeader(value = "X-User-Id", defaultValue = "5") Long adminId) {
        SalleResponseDTO response = salleService.creerSalle(dto, adminId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // BF3.3 : L'administrateur peut modifier une salle
    @PutMapping("/{id}")
    public ResponseEntity<SalleResponseDTO> modifierSalle(@PathVariable Long id,
                                                         @Valid @RequestBody SalleRequestDTO dto,
                                                         @RequestHeader(value = "X-User-Id", defaultValue = "5") Long adminId) {
        return ResponseEntity.ok(salleService.modifierSalle(id, dto, adminId));
    }

    // BF3.2 : L'administrateur peut supprimer une salle
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> supprimerSalle(@PathVariable Long id,
                                              @RequestHeader(value = "X-User-Id", defaultValue = "5") Long adminId) {
        salleService.supprimerSalle(id, adminId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<SalleResponseDTO> getSalle(@PathVariable Long id) {
        return ResponseEntity.ok(salleService.getSalle(id));
    }

    @GetMapping
    public ResponseEntity<List<SalleResponseDTO>> getAllSalles() {
        return ResponseEntity.ok(salleService.getAllSalles());
    }

    // BF3.4 : Le système permet de rechercher une salle libre selon la date et la capacité
    @GetMapping("/disponibles")
    public ResponseEntity<List<SalleResponseDTO>> rechercherSallesLibres(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin,
            @RequestParam(defaultValue = "1") int capaciteMin) {
        return ResponseEntity.ok(salleService.rechercherSallesLibres(debut, fin, capaciteMin));
    }
}
