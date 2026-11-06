import { useMemo } from "react";
import { useQuery } from "@/shared/api/useQuery";
import { useAuth } from "@/shared/auth/AuthContext";
import { getMyRequest, listAvailableRooms, listRequests, listResidences, listTickets, type Viewer } from "../api";
import type { RoomType } from "../types";

/** Identité de l'utilisateur courant, stable entre deux rendus. */
export function useViewer(): Viewer {
  const { user } = useAuth();
  return useMemo(() => ({ id: user.id, name: user.name, role: user.role }), [user.id, user.name, user.role]);
}

export function useResidences() {
  const viewer = useViewer();
  return useQuery((signal) => listResidences(viewer, signal), [viewer.role]);
}

export function useMyRequest() {
  const viewer = useViewer();
  return useQuery((signal) => getMyRequest(viewer, signal), [viewer.id, viewer.role]);
}

export function useRequests() {
  const viewer = useViewer();
  return useQuery((signal) => listRequests(viewer, signal), [viewer.role]);
}

export function useAvailableRooms(residenceId: string, type?: RoomType) {
  const viewer = useViewer();
  return useQuery(
    (signal) => (residenceId ? listAvailableRooms(residenceId, type, viewer, signal) : Promise.resolve([])),
    [residenceId, type, viewer.role],
  );
}

export function useTickets() {
  const viewer = useViewer();
  return useQuery((signal) => listTickets(viewer, signal), [viewer.id, viewer.role]);
}
