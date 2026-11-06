package tn.esprit.gestionetudiant.event;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class InscriptionCreeeEvent {
    private final Long inscriptionId;
    private final Long coursId;
    private final Long etudiantId;
    private final String source;
    private final String statut;
    private final Long groupeId;
}
