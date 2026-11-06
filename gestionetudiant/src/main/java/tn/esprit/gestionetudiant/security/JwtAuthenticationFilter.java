package tn.esprit.gestionetudiant.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import java.io.IOException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Filtre d'authentification JWT partagé avec le user-service (4001).
 *
 * Le front envoie le jeton d'accès dans le cookie httpOnly {@code sc_access}
 * (mode "X-Auth-Mode: cookie") ; un en-tête {@code Authorization: Bearer …}
 * reste accepté pour Swagger, les scripts et les appels interservices.
 *
 * Le jeton est signé en HS256 par le user-service avec le même secret
 * ({@code app.jwt.secret}) : la vérification est donc locale, sans appel réseau.
 * Le rôle porté par le jeton ({@code student} / {@code teacher} / {@code admin})
 * devient une autorité {@code ROLE_<role>} pour Spring Security.
 *
 * Enregistré uniquement dans {@code SecurityConfig} (pas de {@code @Component}) :
 * sinon Spring Boot l'ajouterait aussi comme filtre HTTP générique et il
 * s'exécuterait deux fois par requête.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    public static final String ACCESS_COOKIE = "sc_access";
    public static final String ROLE_PREFIX = "ROLE_";

    private final JwtProperties properties;

    public JwtAuthenticationFilter(JwtProperties properties) {
        this.properties = properties;
    }

    private volatile JwtDecoder decoder;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            String token = extractToken(request);
            if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                authenticate(token);
            }
        } catch (Exception e) {
            // Jeton expiré, altéré ou secret différent : on laisse la requête sans
            // authentification, Spring Security répondra 401 sur les routes protégées.
            log.debug("Jeton JWT rejeté : {}", e.getMessage());
        }
        chain.doFilter(request, response);
    }

    /** Lit le cookie de session, sinon l'en-tête Authorization: Bearer. */
    private String extractToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (ACCESS_COOKIE.equals(cookie.getName()) && cookie.getValue() != null
                        && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String value = header.substring(7).trim();
            return value.isEmpty() ? null : value;
        }
        return null;
    }

    private void authenticate(String token) {
        Jwt jwt = decoder().decode(token);
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

    private JwtDecoder decoder() {
        JwtDecoder local = decoder;
        if (local == null) {
            synchronized (this) {
                local = decoder;
                if (local == null) {
                    SecretKeySpec key = new SecretKeySpec(
                            properties.getSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
                    local = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
                    decoder = local;
                }
            }
        }
        return local;
    }

    /** Principal exposé aux contrôleurs : identifiant, nom, rôle et jeton décodé. */
    public record JwtPrincipal(String id, String name, String role, Jwt jwt) {
    }
}
