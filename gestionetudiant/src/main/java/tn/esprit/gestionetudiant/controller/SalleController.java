package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.common.dto.PageResponse;
import tn.esprit.gestionetudiant.dto.SalleDTO;
import tn.esprit.gestionetudiant.service.ISalleService;

@RestController
@RequestMapping("/api/academic/v1/rooms")
@RequiredArgsConstructor
@Validated
public class SalleController {

    private final ISalleService salleService;

    @GetMapping
    public PageResponse<SalleDTO> lister(
            @RequestParam(required = false) String nom,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return salleService.lister(nom, page, size);
    }

    @GetMapping("/{id}")
    public SalleDTO consulter(@PathVariable Long id) {
        return salleService.consulterParId(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SalleDTO creer(@Valid @RequestBody SalleDTO dto) {
        return salleService.creer(dto);
    }

    @PutMapping("/{id}")
    public SalleDTO modifier(@PathVariable Long id, @Valid @RequestBody SalleDTO dto) {
        return salleService.modifier(id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        salleService.supprimer(id);
    }
}
