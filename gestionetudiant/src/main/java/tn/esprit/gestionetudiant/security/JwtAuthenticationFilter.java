package tn.esprit.gestionetudiant.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Filtre d'authentification JWT partagé avec le user-service (4001).
 *
 * Le front envoie le jeton d'accès dans le cookie httpOnly {@code sc_access}
 * (mode "X-Auth-Mode: cookie") ; un en-tête {@code Authorization: Bearer …}
 * reste accepté pour Swagger, les scripts et les appels interservices.
 *
 * Le jeton est signé en HS256 par le user-service avec le même secret
 * ({@code app.jwt.secret}) : la vérification est donc locale, sans appel réseau.
 * Signature, expiration, ÉMETTEUR et AUDIENCE sont vérifiés. Le rôle porté par le jeton
 * ({@code student} / {@code teacher} / {@code admin}) devient une autorité {@code ROLE_<role>}.
 *
 * Écriture authentifiée par COOKIE (le navigateur joint le cookie tout seul) : protection CSRF — l'en-tête
 * {@code X-Auth-Mode: cookie} ET une origine autorisée ({@code CORS_ORIGINS}) sont exigés, sinon 403.
 *
 * Enregistré uniquement dans {@code SecurityConfig} (pas de {@code @Component}) :
 * sinon Spring Boot l'ajouterait aussi comme filtre HTTP générique et il
 * s'exécuterait deux fois par requête.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    public static final String ACCESS_COOKIE = "sc_access";
    public static final String ROLE_PREFIX = "ROLE_";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final JwtProperties properties;
    private final JwtDecoder decoder;

    public JwtAuthenticationFilter(JwtProperties properties) {
        this.properties = properties;
        SecretKeySpec key = new SecretKeySpec(properties.getSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder nimbus = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> audience = new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                aud -> aud != null && aud.contains(properties.getAudience()));
        nimbus.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(properties.getIssuer()), audience));
        this.decoder = nimbus;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String token = null;
        boolean viaCookie = false;
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (ACCESS_COOKIE.equals(cookie.getName()) && cookie.getValue() != null
                        && !cookie.getValue().isBlank()) {
                    token = cookie.getValue();
                    viaCookie = true;
                    break;
                }
            }
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7) && !header.substring(7).isBlank()) {
            // Un en-tête Bearer explicite l'emporte sur le cookie : pas d'ambiguïté, pas de CSRF possible.
            token = header.substring(7).trim();
            viaCookie = false;
        }

        if (token != null) {
            if (viaCookie && !SAFE_METHODS.contains(request.getMethod()) && !sameAppRequest(request)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"message\":\"Requête refusée (origine non autorisée)\"}");
                return;
            }
            try {
                if (SecurityContextHolder.getContext().getAuthentication() == null) {
                    authenticate(token);
                }
            } catch (Exception e) {
                // Jeton expiré, altéré, autre émetteur/audience ou secret différent : requête laissée sans
                // authentification, Spring Security répondra 401 sur les routes protégées.
                log.debug("Jeton JWT rejeté : {}", e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }

    private boolean sameAppRequest(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        return "cookie".equals(request.getHeader("X-Auth-Mode")) && origin != null
                && properties.allowedOrigins().contains(origin);
    }

    private void authenticate(String token) {
        Jwt jwt = decoder.decode(token);
        List<GrantedAuthority> authorities = new ArrayList<>();
        String role = jwt.getClaimAsString("role");
        if (role != null && !role.isBlank()) {
            authorities.add(new SimpleGrantedAuthority(ROLE_PREFIX + role.toUpperCase()));
        }
        // "sub" = identifiant du user-service (ex. ADM-2026-0001) ; "name" = nom affiché.
        var principal = new JwtPrincipal(jwt.getSubject(), jwt.getClaimAsString("name"), role, jwt);
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    /** Principal exposé aux contrôleurs : identifiant, nom, rôle et jeton décodé. */
    public record JwtPrincipal(String id, String name, String role, Jwt jwt) {
    }
}
