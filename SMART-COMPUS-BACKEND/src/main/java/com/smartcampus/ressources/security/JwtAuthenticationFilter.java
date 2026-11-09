package com.smartcampus.ressources.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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
import java.util.List;
import java.util.Set;

/**
 * Authentifie la requête avec le JWT du user-service : cookie {@code sc_access} (navigateur) ou
 * {@code Authorization: Bearer} (services, scripts). Signature HS256, expiration, émetteur et audience vérifiés.
 *
 * Écriture authentifiée par COOKIE (le navigateur joint le cookie tout seul) : protection CSRF — l'en-tête
 * {@code X-Auth-Mode: cookie} ET une origine autorisée sont exigés, sinon 403.
 *
 * Sans jeton valide, la requête continue SANS authentification : {@link SecurityConfig} répond 401 sur les routes protégées.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    public static final String ACCESS_COOKIE = "sc_access";
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
            throws ServletException, IOException {
        boolean viaCookie = false;
        String token = null;
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7) && !header.substring(7).isBlank()) {
            token = header.substring(7).trim();
        } else if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (ACCESS_COOKIE.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    token = cookie.getValue();
                    viaCookie = true;
                    break;
                }
            }
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
                Jwt jwt = decoder.decode(token);
                String role = jwt.getClaimAsString("role");
                if (jwt.getSubject() != null && role != null && !role.isBlank()) {
                    var principal = new CurrentUser.Principal(jwt.getSubject(), jwt.getClaimAsString("name"), role.toLowerCase());
                    var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                log.debug("Jeton JWT rejeté : {}", e.getMessage());
            }
        }
        chain.doFilter(request, response);
    }

    private boolean sameAppRequest(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        return "cookie".equals(request.getHeader("X-Auth-Mode")) && origin != null && properties.allowedOrigins().contains(origin);
    }
}
