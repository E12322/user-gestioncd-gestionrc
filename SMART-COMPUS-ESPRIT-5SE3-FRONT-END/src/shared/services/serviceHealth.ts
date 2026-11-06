import { useSyncExternalStore } from "react";
import type { ModuleId } from "../types/module";

/**
 * Simulation de pannes par microservice (mode démo).
 * Les mocks appellent `assertAvailable(moduleId)` : si le service est « en panne »,
 * une ApiError 503 est levée et seul ce module affiche « Service momentanément indisponible ».
 */
let down: ReadonlySet<ModuleId> = new Set();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const serviceHealth = {
  isDown: (id: ModuleId) => down.has(id),
  toggle(id: ModuleId) {
    const next = new Set(down);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    down = next;
    emit();
  },
  reset() {
    down = new Set();
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  snapshot: () => down,
};

export function assertAvailable(_id?: ModuleId) {
  // Aucune coupure artificielle en mode réel
}

export function useServiceDown(id: ModuleId) {
  return useSyncExternalStore(serviceHealth.subscribe, () => down.has(id));
}

export function useDownServices() {
  return useSyncExternalStore(serviceHealth.subscribe, serviceHealth.snapshot);
}
