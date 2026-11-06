package tn.esprit.gestionetudiant.event;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class EtudiantAjouteAuGroupeEvent {
    private final Long groupeId;
    private final Long etudiantId;
    private final String nom;
}
