package com.smartcampus.ressources.controller;

import com.smartcampus.ressources.security.CurrentUserArgumentResolver.*;
import com.smartcampus.ressources.dto.*;
import com.smartcampus.ressources.service.IEquipementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/equipements")
public class EquipementController {

    private final IEquipementService equipementService;

    public EquipementController(IEquipementService equipementService) {
        this.equipementService = equipementService;
    }

    // BF3.10 : L'administrateur peut enregistrer un équipement
    @PostMapping
    public ResponseEntity<EquipementResponseDTO> creerEquipement(@Valid @RequestBody EquipementRequestDTO dto,
                                                                 @CurrentUserId Long adminId) {
        EquipementResponseDTO response = equipementService.creerEquipement(dto, adminId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // BF3.10 : L'administrateur peut modifier un équipement
    @PutMapping("/{id}")
    public ResponseEntity<EquipementResponseDTO> modifierEquipement(@PathVariable Long id,
                                                                    @Valid @RequestBody EquipementRequestDTO dto,
                                                                    @CurrentUserId Long adminId) {
        return ResponseEntity.ok(equipementService.modifierEquipement(id, dto, adminId));
    }

    // BF3.10 : L'administrateur peut supprimer un équipement
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> supprimerEquipement(@PathVariable Long id,
                                                    @CurrentUserId Long adminId) {
        equipementService.supprimerEquipement(id, adminId);
        return ResponseEntity.noContent().build();
    }

    // BF3.11 : L'administrateur peut affecter un équipement à une salle ou à un service
    @PutMapping("/{id}/affecter")
    public ResponseEntity<EquipementResponseDTO> affecterEquipement(@PathVariable Long id,
                                                                    @RequestBody AffectationEquipementDTO dto,
                                                                    @CurrentUserId Long adminId) {
        return ResponseEntity.ok(equipementService.affecterEquipement(id, dto, adminId));
    }

    // BF3.12 : Tout utilisateur peut signaler une panne ou un dysfonctionnement d'un équipement
    @PostMapping("/signaler-panne")
    public ResponseEntity<InterventionResponseDTO> signalerPanne(@Valid @RequestBody SignalementPanneDTO dto) {
        InterventionResponseDTO response = equipementService.signalerPanne(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EquipementResponseDTO> getEquipement(@PathVariable Long id) {
        return ResponseEntity.ok(equipementService.getEquipement(id));
    }

    @GetMapping
    public ResponseEntity<List<EquipementResponseDTO>> getAllEquipements() {
        return ResponseEntity.ok(equipementService.getAllEquipements());
    }

    @GetMapping("/salle/{salleId}")
    public ResponseEntity<List<EquipementResponseDTO>> getEquipementsParSalle(@PathVariable Long salleId) {
        return ResponseEntity.ok(equipementService.getEquipementsParSalle(salleId));
    }
}
