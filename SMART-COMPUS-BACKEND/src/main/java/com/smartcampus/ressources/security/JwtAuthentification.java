package com.smartcampus.ressources.security;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Annuaire des utilisateurs branché sur le JWT réel : pour l'utilisateur de la requête courante, rôle et identité
 * viennent du jeton signé par le user-service. Les autres identifiants (techniciens, comptes de démonstration 1 à 6)
 * restent résolus par {@link AuthentificationClientMock} : l'accès HTTP à ces opérations est déjà filtré par rôle dans
 * {@code SecurityConfig}, ce repli ne permet donc à personne de s'élever au-dessus de son rôle.
 */
@Component
@Primary
public class JwtAuthentification implements IAuthentification {

    private final AuthentificationClientMock repli;

    public JwtAuthentification(AuthentificationClientMock repli) {
        this.repli = repli;
    }

    private static Optional<CurrentUser.Principal> courant(Long utilisateurId) {
        return CurrentUser.get().filter(p -> p.numericId().equals(utilisateurId));
    }

    private static String roleMetier(String role) {
        return switch (role == null ? "" : role.toLowerCase()) {
            case "admin" -> "ADMINISTRATEUR";
            case "teacher" -> "ENSEIGNANT";
            case "student" -> "ETUDIANT";
            default -> role == null ? "" : role.toUpperCase();
        };
    }

    @Override
    public boolean verifierAcces(Long utilisateurId, String roleRequis) {
        return courant(utilisateurId)
                .map(p -> p.isAdmin() || roleMetier(p.role()).equalsIgnoreCase(roleRequis))
                .orElseGet(() -> repli.verifierAcces(utilisateurId, roleRequis));
    }

    @Override
    public boolean isCompteActif(Long utilisateurId) {
        return courant(utilisateurId).isPresent() || repli.isCompteActif(utilisateurId);
    }

    @Override
    public UtilisateurInfo obtenirUtilisateur(Long utilisateurId) {
        return courant(utilisateurId)
                .map(p -> new UtilisateurInfo(utilisateurId, p.displayName(),
                        p.displayName().toLowerCase().replace(" ", ".") + "@smartcampus.tn", roleMetier(p.role()), true))
                .orElseGet(() -> repli.obtenirUtilisateur(utilisateurId));
    }
}
