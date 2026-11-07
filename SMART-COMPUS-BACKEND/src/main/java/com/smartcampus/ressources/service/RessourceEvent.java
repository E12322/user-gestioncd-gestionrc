package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import java.time.LocalDateTime;

public record RessourceEvent(
    RessourceEventType type,
    String typeEntite,
    Long entiteId,
    Long auteurId,
    String auteurNom,
    String message,
    String emailDestinataire,
    LocalDateTime timestamp
) {
    public RessourceEvent(RessourceEventType type, String typeEntite, Long entiteId, Long auteurId, String auteurNom, String message, String emailDestinataire) {
        this(type, typeEntite, entiteId, auteurId, auteurNom, message, emailDestinataire, LocalDateTime.now());
    }
}
