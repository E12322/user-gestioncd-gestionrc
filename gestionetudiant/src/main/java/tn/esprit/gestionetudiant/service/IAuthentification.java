package tn.esprit.gestionetudiant.service;

/**
 * Interface pour la communication avec le microservice Utilisateurs/Authentification.
 * Permet de vérifier les rôles des utilisateurs (enseignant, étudiant).
 */
public interface IAuthentification {

    /**
     * Vérifie si l'utilisateur possède le rôle ENSEIGNANT.
     *
     * @param utilisateurId identifiant de l'utilisateur
     * @return true si l'utilisateur est un enseignant valide, false sinon
     */
    boolean verifierRoleEnseignant(Long utilisateurId);

    /**
     * Vérifie si l'utilisateur possède le rôle ETUDIANT.
     *
     * @param utilisateurId identifiant de l'utilisateur
     * @return true si l'utilisateur est un étudiant valide, false sinon
     */
    boolean verifierRoleEtudiant(Long utilisateurId);
}
