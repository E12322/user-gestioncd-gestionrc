package tn.esprit.smartcampus.vie_etudiante.security;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Utilisateur authentifié via le JWT du user-service.
 *
 * @param id   Matricule / identifiant (claim "sub", ex: "ETU-2024-0187", "ADM-2026-0001")
 * @param name Nom affiché (claim "name", ex: "Yasmine Ben Salah")
 * @param role Rôle ("student", "teacher", "admin")
 * @param jwt  Jeton décodé (optionnel en mode développement sans jeton)
 */
public record JwtPrincipal(String id, String name, String role, Jwt jwt) {
    public boolean isAdmin() {
        return "admin".equalsIgnoreCase(role);
    }

    public boolean isStudent() {
        return "student".equalsIgnoreCase(role);
    }

    public boolean isTeacher() {
        return "teacher".equalsIgnoreCase(role);
    }
}
