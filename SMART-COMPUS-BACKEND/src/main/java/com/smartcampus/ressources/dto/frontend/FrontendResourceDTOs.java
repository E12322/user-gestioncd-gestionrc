package com.smartcampus.ressources.dto.frontend;

import java.util.List;

public class FrontendResourceDTOs {

    public record EquipmentDTO(
        String id,
        String label
    ) {}

    public record RoomViewDTO(
        String id,
        String name,
        String building,
        int floor,
        String kind,
        int capacity,
        List<EquipmentDTO> equipment,
        double bookedHoursToday,
        int openHours
    ) {}

    public record BusySlotDTO(
        String start,
        String end,
        String status
    ) {}

    public record AvailabilityDTO(
        String roomId,
        String date,
        List<BusySlotDTO> slots
    ) {}

    public record ReservationInputDTO(
        String roomId,
        String date,
        String start,
        String end,
        int attendees,
        String purpose
    ) {}

    public record FrontendReservationDTO(
        String id,
        String roomId,
        String roomName,
        String building,
        String requesterId,
        String requesterName,
        String date,
        String start,
        String end,
        int attendees,
        String purpose,
        String status,
        String requestedAt,
        String decidedAt
    ) {}

    public record StatusUpdateDTO(
        String status
    ) {}
}
