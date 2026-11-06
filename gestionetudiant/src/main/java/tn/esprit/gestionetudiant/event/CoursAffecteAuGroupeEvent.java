package tn.esprit.gestionetudiant.event;

import lombok.AllArgsConstructor;
import lombok.Getter;
import tn.esprit.gestionetudiant.entity.TypeSeance;

@Getter
@AllArgsConstructor
public class CoursAffecteAuGroupeEvent {
    private final Long groupeId;
    private final Long coursId;
    private final TypeSeance type;
}
