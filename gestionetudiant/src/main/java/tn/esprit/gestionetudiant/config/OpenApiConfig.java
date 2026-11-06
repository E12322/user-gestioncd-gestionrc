package tn.esprit.gestionetudiant.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentation OpenAPI de l'API académique.
 * UI : http://localhost:8080/swagger-ui.html — Spec : http://localhost:8080/v3/api-docs
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI smartCampusOpenApi() {
        return new OpenAPI().info(new Info()
                .title("SmartCampus — API académique")
                .version("v1")
                .description("""
                        Gestion académique : années académiques, salles, groupes, séances (emploi du temps) et cours.
                        Convention : /api/academic/v1/... ; erreurs au format RFC 7807 (ProblemDetail).
                        """));
    }
}
