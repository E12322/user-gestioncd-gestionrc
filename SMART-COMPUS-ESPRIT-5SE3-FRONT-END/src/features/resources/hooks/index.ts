import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import { getAvailability, listReservations, listRooms, type Viewer } from "../api";
import type { RoomFilters } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useRooms(filters: RoomFilters = {}) {
  const viewer = useViewer();
  return useQuery((signal) => listRooms(filters, viewer, signal), [filters.q, filters.building, filters.minCapacity, viewer.role]);
}

export function useAvailability(roomId: string, date: string) {
  const viewer = useViewer();
  return useQuery((signal) => getAvailability(roomId, date, viewer, signal), [roomId, date, viewer.role]);
}

export function useReservations(scope: "mine" | "all") {
  const viewer = useViewer();
  return useQuery((signal) => listReservations(scope, viewer, signal), [scope, viewer.id, viewer.role]);
}
