package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.AnneeAcademiqueDTO;
import tn.esprit.gestionetudiant.service.IAnneeAcademiqueService;

@RestController
@RequestMapping("/api/academic/v1/academic-years")
@RequiredArgsConstructor
@Validated
public class AnneeAcademiqueController {

    private final IAnneeAcademiqueService anneeAcademiqueService;

    @GetMapping
    public PageResponse<AnneeAcademiqueDTO> lister(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return anneeAcademiqueService.lister(page, size);
    }

    @GetMapping("/active")
    public AnneeAcademiqueDTO anneeActive() {
        return anneeAcademiqueService.consulterAnneeActive();
    }

    @GetMapping("/{id}")
    public AnneeAcademiqueDTO consulter(@PathVariable Long id) {
        return anneeAcademiqueService.consulterParId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnneeAcademiqueDTO creer(@Valid @RequestBody AnneeAcademiqueDTO dto) {
        return anneeAcademiqueService.creer(dto);
    }

    @PutMapping("/{id}")
    public AnneeAcademiqueDTO modifier(@PathVariable Long id, @Valid @RequestBody AnneeAcademiqueDTO dto) {
        return anneeAcademiqueService.modifier(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        anneeAcademiqueService.supprimer(id);
    }
}
