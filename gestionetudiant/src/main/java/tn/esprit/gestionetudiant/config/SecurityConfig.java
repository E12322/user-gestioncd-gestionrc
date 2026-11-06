package tn.esprit.gestionetudiant.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tn.esprit.gestionetudiant.security.JwtAuthenticationFilter;
import tn.esprit.gestionetudiant.security.JwtProperties;

import java.util.List;

/**
 * Sécurité du microservice académique (8081).
 *
 * Sans cette classe, Spring Security (présent dans le pom) rejette tout le monde
 * en 401 : le front ne pouvait donc rien lire ni écrire en réel. On garde la
 * protection actuelle (toute route authentifiée par défaut) mais on l'authentifie
 * avec les jetons du user-service : cookie {@code sc_access} ou Bearer, validés
 * localement en HS256.
 *
 * Stateless : la session n'est jamais créée, chaque requête porte son jeton.
 * CORS est exposé à Spring Security pour que les preflights OPTIONS du front
 * (5173) répondent 200 avant l'authentification.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtProperties jwtProperties;

    /**
     * Désactivation provisoire (tests / débogage) : app.security.enforce-auth=false
     * → toutes les routes sont ouvertes, le filtre reste actif.
     */
    @Value("${app.security.enforce-auth:true}")
    private boolean enforceAuth;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtProperties);
        http
                // Cookies cross-site : le front (5173) et l'API (8081) partagent localhost,
                // mais les preflights doivent être traités avant l'authentification.
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    // Ressources publiques : fichiers uploadés, Swagger, santé, erreurs.
                    auth.requestMatchers("/uploads/**", "/swagger-ui/**", "/swagger-ui.html",
                                    "/v3/api-docs/**", "/api/academic/v1/health", "/error")
                            .permitAll();
                    if (enforceAuth) {
                        auth.anyRequest().authenticated();
                    } else {
                        auth.anyRequest().permitAll();
                    }
                })
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                // Sans entrée explicite, Spring Security répond 403 aux requêtes sans jeton :
                // le front a besoin d'un 401 pour tenter le refresh de session.
                .exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.setCharacterEncoding("UTF-8");
                    response.getWriter().write("{\"message\":\"Authentification requise (cookie sc_access ou Bearer)\"}");
                }));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Toutes origines en développement (allowCredentials : cookies httpOnly inclus).
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of(
                HttpMethod.GET.name(), HttpMethod.POST.name(), HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(), HttpMethod.PATCH.name(), HttpMethod.OPTIONS.name()));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        // Utile si un client lit l'identité côté JS (le cookie reste HttpOnly).
        config.setExposedHeaders(List.of(HttpHeaders.SET_COOKIE));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
