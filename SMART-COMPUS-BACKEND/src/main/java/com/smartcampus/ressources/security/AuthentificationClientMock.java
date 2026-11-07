package com.smartcampus.ressources.security;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implémentation locale ou simulateur du Module 1 (Gestion des Utilisateurs)
 * Peut être remplacé par un client OpenFeign / REST en production.
 */
@Component
public class AuthentificationClientMock implements IAuthentification {

    private final Map<Long, UtilisateurInfo> utilisateurs = new ConcurrentHashMap<>();

    public AuthentificationClientMock() {
        // Utilisateurs de démonstration alignés sur les acteurs de la spécification
        utilisateurs.put(1L, new UtilisateurInfo(1L, "Dr. Jean Dupont", "jean.dupont@smartcampus.edu", "ENSEIGNANT", true));
        utilisateurs.put(2L, new UtilisateurInfo(2L, "Prof. Amina Benali", "amina.benali@smartcampus.edu", "ENSEIGNANT", true));
        utilisateurs.put(3L, new UtilisateurInfo(3L, "Directeur Martin", "martin@smartcampus.edu", "RESPONSABLE", true));
        utilisateurs.put(4L, new UtilisateurInfo(4L, "Karim Technicien", "karim.tech@smartcampus.edu", "TECHNICIEN", true));
        utilisateurs.put(5L, new UtilisateurInfo(5L, "Admin Campus", "admin@smartcampus.edu", "ADMINISTRATEUR", true));
        utilisateurs.put(6L, new UtilisateurInfo(6L, "Lucas Étudiant", "lucas.etudiant@smartcampus.edu", "ETUDIANT", true));
    }

    @Override
    public boolean verifierAcces(Long utilisateurId, String roleRequis) {
        UtilisateurInfo user = utilisateurs.get(utilisateurId);
        if (user == null || !user.actif()) {
            return false;
        }
        if ("ADMINISTRATEUR".equalsIgnoreCase(user.role())) {
            return true; // Un admin a tous les droits
        }
        return user.role().equalsIgnoreCase(roleRequis);
    }

    @Override
    public boolean isCompteActif(Long utilisateurId) {
        UtilisateurInfo user = utilisateurs.get(utilisateurId);
        return user != null && user.actif();
    }

    @Override
    public UtilisateurInfo obtenirUtilisateur(Long utilisateurId) {
        return utilisateurs.get(utilisateurId);
    }

    public void enregistrerUtilisateur(UtilisateurInfo utilisateur) {
        utilisateurs.put(utilisateur.id(), utilisateur);
    }
}
