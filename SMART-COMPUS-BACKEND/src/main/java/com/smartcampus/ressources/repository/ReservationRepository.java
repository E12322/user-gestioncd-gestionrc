package com.smartcampus.ressources.repository;

import com.smartcampus.ressources.entity.Reservation;
import com.smartcampus.ressources.entity.Salle;
import com.smartcampus.ressources.enums.StatutReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByDemandeurId(Long demandeurId);

    List<Reservation> findByStatut(StatutReservation statut);

    List<Reservation> findByRessourceId(Long ressourceId);

    @Query("SELECT r FROM Reservation r WHERE r.ressource.id = :ressourceId " +
           "AND r.statut IN (com.smartcampus.ressources.enums.StatutReservation.DEMANDEE, com.smartcampus.ressources.enums.StatutReservation.VALIDEE) " +
           "AND r.dateDebut < :fin AND r.dateFin > :debut")
    List<Reservation> findConflictingReservations(@Param("ressourceId") Long ressourceId,
                                                  @Param("debut") LocalDateTime debut,
                                                  @Param("fin") LocalDateTime fin);

    @Query("SELECT r FROM Reservation r WHERE r.ressource.id = :ressourceId " +
           "AND r.id <> :excludeReservationId " +
           "AND r.statut IN (com.smartcampus.ressources.enums.StatutReservation.DEMANDEE, com.smartcampus.ressources.enums.StatutReservation.VALIDEE) " +
           "AND r.dateDebut < :fin AND r.dateFin > :debut")
    List<Reservation> findConflictingReservationsExcluding(@Param("ressourceId") Long ressourceId,
                                                           @Param("excludeReservationId") Long excludeReservationId,
                                                           @Param("debut") LocalDateTime debut,
                                                           @Param("fin") LocalDateTime fin);

    @Query("SELECT s FROM Salle s WHERE s.disponible = true " +
           "AND s.capacite >= :capaciteMin " +
           "AND s.id NOT IN (" +
           "   SELECT r.ressource.id FROM Reservation r " +
           "   WHERE r.statut IN (com.smartcampus.ressources.enums.StatutReservation.DEMANDEE, com.smartcampus.ressources.enums.StatutReservation.VALIDEE) " +
           "   AND r.dateDebut < :fin AND r.dateFin > :debut" +
           ")")
    List<Salle> findAvailableSalles(@Param("debut") LocalDateTime debut,
                                   @Param("fin") LocalDateTime fin,
                                   @Param("capaciteMin") int capaciteMin);
}
