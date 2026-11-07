package com.smartcampus.ressources.security;

public record UtilisateurInfo(
    Long id,
    String nom,
    String email,
    String role,
    boolean actif
) {}
