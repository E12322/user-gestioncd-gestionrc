package tn.esprit.gestionetudiant.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tn.esprit.gestionetudiant.dto.InscriptionDecisionDTO;
import tn.esprit.gestionetudiant.dto.InscriptionRequestDTO;
import tn.esprit.gestionetudiant.dto.InscriptionResponseDTO;
import tn.esprit.gestionetudiant.exception.BusinessException;
import tn.esprit.gestionetudiant.security.JwtAuthenticationFilter;
import tn.esprit.gestionetudiant.service.IInscriptionService;

import java.util.List;

/**
 * Inscriptions aux cours (persistées en PostgreSQL).
 *
 * - étudiant : POST (demande) et GET ?etudiantId= (ses demandes) — un étudiant
 *   ne lit que les siennes, quel que soit le paramètre envoyé ;
 * - admin : GET (toutes / ?coursId=) et PUT /{id} pour valider ou refuser.
 */
@RestController
@RequestMapping({"/enrollments", "/api/academic/v1/enrollments"})
@RequiredArgsConstructor
public class InscriptionController {

    private final IInscriptionService inscriptionService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public InscriptionResponseDTO demander(@Valid @RequestBody InscriptionRequestDTO request,
                                           @AuthenticationPrincipal JwtAuthenticationFilter.JwtPrincipal principal) {
        return inscriptionService.demander(request.getCoursId(), userId(principal));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public List<InscriptionResponseDTO> lister(
            @RequestParam(required = false) Long etudiantId,
            @RequestParam(required = false) Long coursId,
            @AuthenticationPrincipal JwtAuthenticationFilter.JwtPrincipal principal) {
        // Un étudiant n'a accès qu'à ses propres demandes (le paramètre est ignoré).
        if (principal != null && "student".equals(principal.role())) {
            return inscriptionService.lister(userId(principal), coursId);
        }
        return inscriptionService.lister(etudiantId, coursId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public InscriptionResponseDTO decider(@PathVariable Long id,
                                          @Valid @RequestBody InscriptionDecisionDTO decision) {
        return inscriptionService.decider(id, decision.getStatus());
    }

    /** Identifiant numérique du user-service (sub "ETU-2026-0002" → 20260002). */
    private static Long userId(JwtAuthenticationFilter.JwtPrincipal principal) {
        if (principal == null || principal.id() == null) {
            throw new BusinessException("Jeton sans identifiant utilisateur (claim sub manquant)");
        }
        String digits = principal.id().replaceAll("\\D", "");
        if (digits.isEmpty()) {
            throw new BusinessException("Identifiant utilisateur sans chiffres : " + principal.id());
        }
        return Long.parseLong(digits);
    }
}
