package tn.esprit.gestionetudiant.exception;

/**
 * Conflit métier (créneau déjà occupé, ressource déjà utilisée, doublon...).
 * Mappée en HTTP 409 par le gestionnaire global.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
