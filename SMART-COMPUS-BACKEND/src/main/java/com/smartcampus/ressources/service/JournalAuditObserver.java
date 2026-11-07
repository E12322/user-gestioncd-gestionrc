package com.smartcampus.ressources.service;

import com.smartcampus.ressources.enums.*;

import com.smartcampus.ressources.entity.AuditLog;
import com.smartcampus.ressources.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Observateur : Journal d'audit pour la traçabilité des opérations sensibles (BNF.8 - Slide 63 & 76).
 */
@Component
public class JournalAuditObserver implements RessourceObserver {

    private static final Logger log = LoggerFactory.getLogger(JournalAuditObserver.class);
    private final AuditLogRepository auditLogRepository;

    public JournalAuditObserver(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    public void mettreAJour(RessourceEvent evenement) {
        AuditLog logEntry = new AuditLog(
                evenement.type().name(),
                evenement.typeEntite(),
                evenement.entiteId(),
                evenement.auteurId(),
                evenement.auteurNom(),
                evenement.message()
        );
        auditLogRepository.save(logEntry);
        log.info("[AUDIT BNF.8] Opération sensible journalisée : {} par {} (ID: {})",
                evenement.type(), evenement.auteurNom(), evenement.auteurId());
    }
}
