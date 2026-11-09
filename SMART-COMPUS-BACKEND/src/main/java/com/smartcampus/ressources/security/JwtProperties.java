package com.smartcampus.ressources.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

/**
 * Paramètres JWT partagés avec le user-service (4001) : même secret, même émetteur, même audience.
 * Le service valide donc les jetons localement, sans appeler le user-service.
 *
 * En production : {@code JWT_SECRET} DOIT être défini (le service refuse de démarrer sinon, voir {@link SecurityConfig}).
 * {@code CORS_ORIGINS} : origines autorisées du front, séparées par des virgules (aussi utilisées contre le CSRF).
 */
@Configuration
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** Valeur par défaut de DÉVELOPPEMENT seulement (identique à celle des autres services). */
    public static final String DEV_SECRET = "change-me-en-production-32-caracteres-minimum";

    private String secret = DEV_SECRET;
    private String issuer = "smartcampus-user-service";
    private String audience = "smartcampus";
    /** Origines du front autorisées (CORS + contrôle CSRF des écritures par cookie). */
    private String corsOrigins = "http://localhost:5173";

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }
    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }
    public String getCorsOrigins() { return corsOrigins; }
    public void setCorsOrigins(String corsOrigins) { this.corsOrigins = corsOrigins; }

    public List<String> allowedOrigins() {
        return Arrays.stream(corsOrigins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
