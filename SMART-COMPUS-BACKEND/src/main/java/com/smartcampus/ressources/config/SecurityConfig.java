package com.smartcampus.ressources.config;

import com.smartcampus.ressources.security.JwtAuthenticationFilter;
import com.smartcampus.ressources.security.JwtProperties;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Sécurité du service Ressources.
 *
 * Avant : AUCUNE authentification. N'importe qui pouvait lire, réserver, valider ou refuser, et l'identité venait
 * d'en-têtes X-User-* avec des valeurs par défaut (« Karim Trabelsi », enseignant). Désormais :
 *  - toute route exige un JWT du user-service (cookie sc_access ou Bearer) ;
 *  - l'identité est celle du jeton ; les rôles sont contrôlés ici ;
 *  - les écritures par cookie exigent X-Auth-Mode + une origine autorisée (CSRF) ;
 *  - en profil « prod », le secret JWT par défaut est refusé.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtProperties jwtProperties;
    private final Environment environment;

    public SecurityConfig(JwtProperties jwtProperties, Environment environment) {
        this.jwtProperties = jwtProperties;
        this.environment = environment;
    }

    @PostConstruct
    void refuserConfigurationFaibleEnProduction() {
        if (environment.acceptsProfiles(Profiles.of("prod"))
                && (JwtProperties.DEV_SECRET.equals(jwtProperties.getSecret()) || jwtProperties.getSecret().length() < 32)) {
            throw new IllegalStateException(
                    "JWT_SECRET doit être défini en production (32 caractères minimum, identique à celui du user-service)");
        }
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable) // CSRF traité par JwtAuthenticationFilter (en-tête + origine)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.frameOptions(f -> f.sameOrigin()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/h2-console/**").hasRole("ADMIN")
                        // Consultation : tout utilisateur connecté (étudiants compris, pour l'assistant).
                        .requestMatchers(HttpMethod.GET, "/api/rooms", "/api/rooms/*/availability").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/reservations").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/equipements/**").authenticated()
                        // Réserver : enseignants et administrateurs (comme l'interface). Annuler : propriétaire ou admin (contrôleur).
                        .requestMatchers(HttpMethod.POST, "/api/reservations").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/reservations/*").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/equipements/signaler-panne").hasAnyRole("TEACHER", "ADMIN")
                        // Décider d'une réservation, gérer équipements / interventions / API interne : administrateur.
                        .requestMatchers(HttpMethod.PUT, "/api/reservations/*/status").hasRole("ADMIN")
                        .requestMatchers("/api/equipements/**", "/api/interventions/**", "/api/internal/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(new JwtAuthenticationFilter(jwtProperties), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        // 401 (et non 403) sans jeton : le front en a besoin pour tenter le renouvellement de session.
                        .authenticationEntryPoint((request, response, e) -> json(response, 401,
                                "{\"message\":\"Authentification requise (cookie sc_access ou Bearer)\"}"))
                        .accessDeniedHandler((request, response, e) -> json(response, 403,
                                "{\"message\":\"Accès refusé : droits insuffisants\"}")));
        return http.build();
    }

    private static void json(HttpServletResponse response, int status, String body) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(body);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(jwtProperties.allowedOrigins()); // origines précises : jamais « * » avec des cookies
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
