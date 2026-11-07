package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Sujet (Subject) du patron Observateur (Slide 63).
 * Maintient la liste des observateurs et les notifie lors de chaque événement.
 */
@Component
public class RessourceEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(RessourceEventPublisher.class);
    private final List<RessourceObserver> observateurs = new CopyOnWriteArrayList<>();

    public RessourceEventPublisher(List<RessourceObserver> observateursInitiaux) {
        if (observateursInitiaux != null) {
            this.observateurs.addAll(observateursInitiaux);
        }
    }

    public void attacher(RessourceObserver observateur) {
        if (observateur != null && !observateurs.contains(observateur)) {
            observateurs.add(observateur);
            log.info("Observateur attaché: {}", observateur.getClass().getSimpleName());
        }
    }

    public void detacher(RessourceObserver observateur) {
        observateurs.remove(observateur);
        log.info("Observateur détaché: {}", observateur.getClass().getSimpleName());
    }

    public void notifier(RessourceEvent evenement) {
        log.info("Notification d'événement [{}]: {}", evenement.type(), evenement.message());
        for (RessourceObserver observateur : observateurs) {
            try {
                observateur.mettreAJour(evenement);
            } catch (Exception e) {
                log.error("Erreur lors de la mise à jour de l'observateur {}: {}", observateur.getClass().getSimpleName(), e.getMessage());
            }
        }
    }
}
