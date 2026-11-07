package tn.esprit.smartcampus.vie_etudiante.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {
    private String jwksUri = "http://localhost:4001/.well-known/jwks.json";
    private String secret = "change-me-en-production-32-caracteres-minimum";
    private String issuer = "smartcampus-user-service";
    private String audience = "smartcampus";
}
