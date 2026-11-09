package tn.esprit.gestionetudiant.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

/**
 * Paramètres JWT partagés avec le user-service (4001) : même secret, même
 * issuer, même audience — le microservice académique valide donc les mêmes
 * jetons sans jamais appeler le user-service.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** Valeurs par défaut de DÉVELOPPEMENT : interdites en production (voir SecurityConfig). */
    public static final String DEV_SECRET = "smartcampus-super-secret-jwt-key-2026-esprit-32chars!";
    public static final String USER_SERVICE_DEV_SECRET = "change-me-en-production-32-caracteres-minimum";

    /** Secret de signature HS256 (identique à JWT_SECRET du user-service). */
    private String secret = USER_SERVICE_DEV_SECRET;

    /** Émetteur attendu (iss) : smartcampus-user-service. */
    private String issuer = "smartcampus-user-service";

    /** Audience attendue (aud) : smartcampus. */
    private String audience = "smartcampus";

    /**
     * Origines du front autorisées (CORS_ORIGINS, séparées par des virgules). Utilisées aussi contre le CSRF :
     * une écriture authentifiée par cookie doit venir d'une de ces origines.
     */
    private String corsOrigins = "http://localhost:5173";

    public List<String> allowedOrigins() {
        return Arrays.stream(corsOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
