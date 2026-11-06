package tn.esprit.gestionetudiant.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Santé du microservice académique (route publique) : le front et les scripts
 * peuvent vérifier que Spring Boot répond avant d'appeler les autres routes.
 */
@RestController
@RequestMapping("/api/academic/v1")
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "gestionetudiant",
                "timestamp", Instant.now().toString());
    }
}
