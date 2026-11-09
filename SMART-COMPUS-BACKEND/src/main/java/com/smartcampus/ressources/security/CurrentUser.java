package com.smartcampus.ressources.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Optional;

/**
 * Utilisateur authentifié de la requête courante, lu dans le jeton JWT (jamais dans des en-têtes envoyés par le client).
 *
 * Le jeton porte un identifiant TEXTE du user-service (ex. {@code ETU-2026-0002}) alors que ce service stocke des
 * identifiants numériques : {@link #numericId(String)} en dérive un nombre stable (SHA-256), identique à chaque appel.
 */
public final class CurrentUser {

    /** Identité portée par le jeton. */
    public record Principal(String sub, String name, String role) {
        public boolean isAdmin() { return "admin".equalsIgnoreCase(role); }
        public Long numericId() { return CurrentUser.numericId(sub); }
        public String displayName() { return (name == null || name.isBlank()) ? sub : name; }
    }

    private CurrentUser() { }

    public static Optional<Principal> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Principal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }

    public static Principal require() {
        return get().orElseThrow(() -> new IllegalStateException("Aucun utilisateur authentifié"));
    }

    /** Identifiant numérique stable (63 bits, jamais 0) dérivé de l'identifiant texte du jeton. */
    public static Long numericId(String sub) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(sub.getBytes(StandardCharsets.UTF_8));
            long value = ByteBuffer.wrap(digest, 0, 8).getLong() & Long.MAX_VALUE;
            return value == 0 ? 1L : value;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
