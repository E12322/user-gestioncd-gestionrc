package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByTypeEntiteAndEntiteIdOrderByDateActionDesc(String typeEntite, Long entiteId);
    List<AuditLog> findByUtilisateurIdOrderByDateActionDesc(Long utilisateurId);
    List<AuditLog> findAllByOrderByDateActionDesc();
}
