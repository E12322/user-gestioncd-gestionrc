package tn.esprit.smartcampus.vie_etudiante.security;

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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    public static final String ACCESS_COOKIE = "sc_access";
    public static final String ROLE_PREFIX = "ROLE_";

    private final JwtProperties properties;
    private final boolean enforceAuth;

    private volatile JwtDecoder jwksDecoder;
    private volatile JwtDecoder hmacDecoder;

    public JwtAuthenticationFilter(JwtProperties properties, boolean enforceAuth) {
        this.properties = properties;
        this.enforceAuth = enforceAuth;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        try {
            String token = extractToken(request);
            if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                authenticateFromToken(token);
            } else if (!enforceAuth && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Mode de développement souple : support des en-têtes explicites pour tests curl/Postman
                authenticateFromDevHeaders(request);
            }
        } catch (Exception e) {
            log.debug("Validation du jeton ignorée ou échouée : {}", e.getMessage());
        }
        chain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        // 1. Cookie sc_access envoyé avec credentials: "include"
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (ACCESS_COOKIE.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        // 2. En-tête Authorization: Bearer
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String value = header.substring(7).trim();
            return value.isEmpty() ? null : value;
        }
        return null;
    }

    private void authenticateFromToken(String token) {
        Jwt jwt = decodeToken(token);
        if (jwt == null) return;

        String role = jwt.getClaimAsString("role");
        String sub = jwt.getSubject();
        String name = jwt.getClaimAsString("name");

        List<GrantedAuthority> authorities = new ArrayList<>();
        if (role != null && !role.isBlank()) {
            authorities.add(new SimpleGrantedAuthority(ROLE_PREFIX + role.toUpperCase()));
        }

        var principal = new JwtPrincipal(sub, name != null ? name : sub, role != null ? role.toLowerCase() : "student", jwt);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private Jwt decodeToken(String token) {
        // Essayer d'abord la clé publique JWKS (RS256)
        try {
            return getJwksDecoder().decode(token);
        } catch (Exception eJwks) {
            // Repli sur le secret partagé HS256 (mode transition du user-service sans clés RSA)
            try {
                return getHmacDecoder().decode(token);
            } catch (Exception eHmac) {
                log.debug("Échec décodage token (RS256: {}, HS256: {})", eJwks.getMessage(), eHmac.getMessage());
                return null;
            }
        }
    }

    private void authenticateFromDevHeaders(HttpServletRequest request) {
        String devUserId = request.getHeader("X-User-Id");
        if (devUserId != null && !devUserId.isBlank()) {
            String devRole = request.getHeader("X-User-Role");
            String devName = request.getHeader("X-User-Name");
            String role = (devRole != null && !devRole.isBlank()) ? devRole.toLowerCase() : "student";
            String name = (devName != null && !devName.isBlank()) ? devName : devUserId;

            List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(ROLE_PREFIX + role.toUpperCase()));
            var principal = new JwtPrincipal(devUserId, name, role, null);
            var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
    }

    private JwtDecoder getJwksDecoder() {
        if (jwksDecoder == null) {
            synchronized (this) {
                if (jwksDecoder == null) {
                    jwksDecoder = NimbusJwtDecoder.withJwkSetUri(properties.getJwksUri()).build();
                }
            }
        }
        return jwksDecoder;
    }

    private JwtDecoder getHmacDecoder() {
        if (hmacDecoder == null) {
            synchronized (this) {
                if (hmacDecoder == null) {
                    SecretKeySpec key = new SecretKeySpec(
                            properties.getSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
                    hmacDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
                }
            }
        }
        return hmacDecoder;
    }
}
