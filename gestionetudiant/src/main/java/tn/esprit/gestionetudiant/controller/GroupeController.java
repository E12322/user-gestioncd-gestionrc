package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AffectationDTO;
import tn.esprit.gestionetudiant.dto.EtudiantDTO;
import tn.esprit.gestionetudiant.dto.GroupeDTO;
import tn.esprit.gestionetudiant.service.IGroupeService;

@RestController
@RequestMapping("/api/academic/v1/groups")
@RequiredArgsConstructor
@Validated
public class GroupeController {

    private final IGroupeService groupeService;

    @GetMapping
    public PageResponse<GroupeDTO> lister(
            @RequestParam(required = false) Long coursId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return groupeService.lister(coursId, page, size);
    }

    @GetMapping("/{id}")
    public GroupeDTO consulter(@PathVariable Long id) {
        return groupeService.consulterParId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupeDTO creer(@Valid @RequestBody GroupeDTO dto) {
        return groupeService.creer(dto);
    }

    @PutMapping("/{id}")
    public GroupeDTO modifier(@PathVariable Long id, @Valid @RequestBody GroupeDTO dto) {
        return groupeService.modifier(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        groupeService.supprimer(id);
    }

    /** POST /groups/{id}/etudiants — inscription d'un étudiant dans la classe (201, 409 si complète/doublon). */
    @PostMapping("/{id}/etudiants")
    @ResponseStatus(HttpStatus.CREATED)
    public EtudiantDTO ajouterEtudiant(@PathVariable Long id, @Valid @RequestBody EtudiantDTO etudiant) {
        return groupeService.ajouterEtudiant(id, etudiant);
    }

    /** DELETE /groups/{id}/etudiants/{etudiantId} — retrait d'un étudiant (204). */
    @DeleteMapping("/{id}/etudiants/{etudiantId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retirerEtudiant(@PathVariable Long id, @PathVariable Long etudiantId) {
        groupeService.retirerEtudiant(id, etudiantId);
    }

    /** POST /groups/{id}/cours — affectation d'un cours avec son type (201, 409 si déjà affecté). */
    @PostMapping("/{id}/cours")
    @ResponseStatus(HttpStatus.CREATED)
    public AffectationDTO affecterCours(@PathVariable Long id, @RequestBody AffectationDTO affectation) {
        return groupeService.affecterCours(id, affectation);
    }

    /** DELETE /groups/{id}/cours/{coursId} — retrait d'un cours affecté (204). */
    @DeleteMapping("/{id}/cours/{coursId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retirerCours(@PathVariable Long id, @PathVariable Long coursId) {
        groupeService.retirerCours(id, coursId);
    }
}
