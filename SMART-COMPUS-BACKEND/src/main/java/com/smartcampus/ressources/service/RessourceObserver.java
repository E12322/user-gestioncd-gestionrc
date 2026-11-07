package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

/**
 * Interface Observateur selon la spécification architecturale (Slide 63).
 */
public interface RessourceObserver {
    void mettreAJour(RessourceEvent evenement);
}
