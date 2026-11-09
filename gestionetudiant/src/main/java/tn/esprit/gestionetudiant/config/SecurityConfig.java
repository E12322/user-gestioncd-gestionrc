package tn.esprit.gestionetudiant.config;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
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
import tn.esprit.gestionetudiant.security.AccessRules;
import tn.esprit.gestionetudiant.security.JwtAuthenticationFilter;
import tn.esprit.gestionetudiant.security.JwtProperties;

import java.util.List;

/**
 * Sécurité du microservice académique (8081).
 *
 * Authentification : jetons du user-service (cookie {@code sc_access} ou Bearer), validés localement en HS256
 * (signature, expiration, émetteur, audience). Stateless.
 *
 * AUTORISATION (ajoutée) : auparavant toute personne connectée, étudiant compris, pouvait supprimer un cours
 * ou modifier des notes, car seules 3 routes d'inscription vérifiaient un rôle. Désormais, par URL :
 *  - cours, années académiques, groupes, salles, séances, planifications : écriture réservée à l'ADMINISTRATEUR ;
 *  - notes et absences : écriture réservée aux ENSEIGNANTS et ADMINISTRATEURS ;
 *  - téléversement de fichiers : enseignants et administrateurs ;
 *  - lecture des notes/absences d'un étudiant : lui-même, ou le personnel ; listes globales : personnel ;
 *  - le reste (catalogue des cours, emploi du temps…) : tout utilisateur connecté ;
 *  - inscriptions : règles {@code @PreAuthorize} du contrôleur.
 * CORS : origines précises (CORS_ORIGINS), plus de « * » avec des cookies.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String V1 = "/api/academic/v1";
    private static final String[] COURSES = {V1 + "/courses/**", "/cours/**"};
    private static final String[] PLANIFICATIONS = {V1 + "/planifications/**", "/planifications/**"};
    private static final String[] ADMIN_WRITE_ONLY = {
            V1 + "/academic-years/**", V1 + "/groups/**", V1 + "/rooms/**", V1 + "/sessions/**"};
    private static final String[] EVALUATIONS = {V1 + "/evaluations", "/evaluations"};

    private final JwtProperties jwtProperties;
    private final Environment environment;

    /**
     * Désactivation provisoire (tests / débogage) : app.security.enforce-auth=false
     * → toutes les routes sont ouvertes, le filtre reste actif.
     */
    @Value("${app.security.enforce-auth:true}")
    private boolean enforceAuth;

    @PostConstruct
    void refuserSecretParDefautEnProduction() {
        String s = jwtProperties.getSecret();
        if (environment.acceptsProfiles(Profiles.of("prod"))
                && (JwtProperties.DEV_SECRET.equals(s) || JwtProperties.USER_SERVICE_DEV_SECRET.equals(s) || s.length() < 32)) {
            throw new IllegalStateException(
                    "JWT_SECRET doit être défini en production (32 caractères minimum, identique à celui du user-service)");
        }
    }

    private static final List<HttpMethod> WRITES =
            List.of(HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE);

    private static String[] under(String[] bases, String tail) {
        return java.util.Arrays.stream(bases).map(b -> b + tail).toArray(String[]::new);
    }

    private static String[] flat(String[]... groups) {
        return java.util.Arrays.stream(groups).flatMap(java.util.Arrays::stream).toArray(String[]::new);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtProperties);
        http
                // Les preflights OPTIONS du front doivent être traités avant l'authentification.
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable) // CSRF traité par JwtAuthenticationFilter (en-tête + origine)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    // Ressources publiques : fichiers uploadés, Swagger, santé, erreurs.
                    auth.requestMatchers("/uploads/**", "/swagger-ui/**", "/swagger-ui.html",
                                    "/v3/api-docs/**", "/api/academic/v1/health", "/error")
                            .permitAll();
                    if (!enforceAuth) {
                        auth.anyRequest().permitAll();
                        return;
                    }
                    // --- Lectures de données personnelles : l'étudiant concerné ou le personnel ---
                    auth.requestMatchers(HttpMethod.GET, under(EVALUATIONS, "/notes/etudiant/**"))
                            .access(AccessRules::ownerOrStaffInPath);
                    auth.requestMatchers(HttpMethod.GET, under(EVALUATIONS, "/absences/etudiant/**"))
                            .access(AccessRules::ownerOrStaffInPath);
                    auth.requestMatchers(HttpMethod.GET, under(EVALUATIONS, "/absences"))
                            .access(AccessRules::ownerOrStaffInQuery);
                    // --- Listes globales : personnel seulement ---
                    auth.requestMatchers(HttpMethod.GET, flat(under(EVALUATIONS, "/notes"),
                                    under(EVALUATIONS, "/notes/cours/**"), under(EVALUATIONS, "/absences/alerte")))
                            .hasAnyRole("TEACHER", "ADMIN");
                    // --- Écritures : notes et absences = enseignants et administrateurs ; fichiers idem ---
                    for (HttpMethod m : WRITES) {
                        auth.requestMatchers(m, under(EVALUATIONS, "/**")).hasAnyRole("TEACHER", "ADMIN");
                    }
                    auth.requestMatchers(HttpMethod.POST, V1 + "/files/upload").hasAnyRole("TEACHER", "ADMIN");
                    // --- Écritures sur le catalogue et l'organisation : administrateur ---
                    for (HttpMethod m : WRITES) {
                        auth.requestMatchers(m, COURSES).hasRole("ADMIN");
                        auth.requestMatchers(m, PLANIFICATIONS).hasRole("ADMIN");
                        auth.requestMatchers(m, ADMIN_WRITE_ONLY).hasRole("ADMIN");
                    }
                    // Inscriptions : @PreAuthorize sur le contrôleur. Tout le reste : utilisateur connecté.
                    auth.anyRequest().authenticated();
                })
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        // Sans entrée explicite, Spring Security répond 403 aux requêtes sans jeton :
                        // le front a besoin d'un 401 pour tenter le refresh de session.
                        .authenticationEntryPoint((request, response, authException) -> json(response, 401,
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
        // Origines précises (CORS_ORIGINS) : « * » avec des cookies laisserait n'importe quel site appeler l'API.
        config.setAllowedOrigins(jwtProperties.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
