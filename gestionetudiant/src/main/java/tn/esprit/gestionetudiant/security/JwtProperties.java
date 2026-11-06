package tn.esprit.gestionetudiant.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

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

    /** Secret de signature HS256 (identique à JWT_SECRET du user-service). */
    private String secret = "change-me-en-production-32-caracteres-minimum";

    /** Émetteur attendu (iss) : smartcampus-user-service. */
    private String issuer = "smartcampus-user-service";

    /** Audience attendue (aud) : smartcampus. */
    private String audience = "smartcampus";
}
