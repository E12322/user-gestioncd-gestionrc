package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Observateur : Envoi de notifications par e-mail (Service SMTP - Slide 63).
 */
@Component
public class NotificationEmailObserver implements RessourceObserver {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailObserver.class);

    @Override
    public void mettreAJour(RessourceEvent evenement) {
        if (evenement.emailDestinataire() != null && !evenement.emailDestinataire().isBlank()) {
            // Simulation d'envoi SMTP (Port 587)
            log.info("[SMTP 587] E-mail envoyé à <{}> | Sujet: [{}] | Message: {}",
                    evenement.emailDestinataire(),
                    evenement.type(),
                    evenement.message());
        }
    }
}
