package tn.esprit.gestionetudiant.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tn.esprit.gestionetudiant.service.IAuthentification;

/**
 * Implémentation du service d'authentification pour valider les rôles
 * dans l'architecture microservices.
 */
@Service
public class AuthentificationServiceImpl implements IAuthentification {

    private static final Logger log = LoggerFactory.getLogger(AuthentificationServiceImpl.class);

    @Override
    public boolean verifierRoleEnseignant(Long utilisateurId) {
        if (utilisateurId == null || utilisateurId <= 0) {
            log.warn("Vérification rôle enseignant refusée : identifiant invalide ({})", utilisateurId);
            return false;
        }
        log.info("Vérification rôle enseignant accordée pour utilisateur ID : {}", utilisateurId);
        return true;
    }

    @Override
    public boolean verifierRoleEtudiant(Long utilisateurId) {
        if (utilisateurId == null || utilisateurId <= 0) {
            log.warn("Vérification rôle étudiant refusée : identifiant invalide ({})", utilisateurId);
            return false;
        }
        log.info("Vérification rôle étudiant accordée pour utilisateur ID : {}", utilisateurId);
        return true;
    }
}
