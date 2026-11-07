package com.smartcampus.ressources.security;

/**
 * Interface du Module 1 (Gestion des Utilisateurs)
 * Utilisée selon la spécification architecturale pour vérifier les accès et rôles.
 */
public interface IAuthentification {

    boolean verifierAcces(Long utilisateurId, String roleRequis);

    boolean isCompteActif(Long utilisateurId);

    UtilisateurInfo obtenirUtilisateur(Long utilisateurId);
}
