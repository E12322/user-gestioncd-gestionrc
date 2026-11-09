import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Vérifie à quel service chaque préfixe d'URL est envoyé (mode réel, VITE_USE_MOCKS=false).
 * Garde-fou : le module Vie étudiante (/clubs, /events, /memberships) partait à tort vers le service académique.
 */
describe("routage des appels API vers les microservices", () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCKS", "false");
    vi.stubEnv("VITE_API_BASE_URL", "http://academic.test/api");
    vi.stubEnv("VITE_USER_API_BASE_URL", "/svc/user");
    vi.stubEnv("VITE_LIBRARY_API_BASE_URL", "http://library.test");
    vi.stubEnv("VITE_RESIDENCES_API_BASE_URL", "http://residences.test/api");
    vi.stubEnv("VITE_STUDENT_LIFE_API_BASE_URL", "/svc/vie");
    vi.stubEnv("VITE_RESOURCES_API_BASE_URL", "http://resources.test/api");
    vi.stubEnv("VITE_REAL_API_PREFIXES", "/auth,/users,/clubs,/events,/memberships,/reports,/books,/chambres,/academic,/rooms,/reservations");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ["/clubs", "/svc/vie/clubs"],
    ["/clubs/k1", "/svc/vie/clubs/k1"],
    ["/events", "/svc/vie/events"],
    ["/memberships/mine", "/svc/vie/memberships/mine"],
    ["/events/my-registrations", "/svc/vie/events/my-registrations"],
    ["/reports/clubs/k1?year=2026", "/svc/vie/reports/clubs/k1?year=2026"],
    ["/rooms", "http://resources.test/api/rooms"],
    ["/rooms/7/availability?date=2026-11-10", "http://resources.test/api/rooms/7/availability?date=2026-11-10"],
    ["/reservations", "http://resources.test/api/reservations"],
    ["/reservations?status=PENDING", "http://resources.test/api/reservations?status=PENDING"],
    ["/reservations/12/status", "http://resources.test/api/reservations/12/status"],
    ["/reservations/5", "http://library.test/reservations/5"], // annulation d'une réservation de LIVRE : reste à la bibliothèque
    ["/users", "/svc/user/users"],
    ["/books", "http://library.test/books"],
    ["/chambres", "http://residences.test/api/chambres"],
  ])("%s est envoyé à %s", async (path, expected) => {
    const { api } = await import("./client");
    await api.get(path, { mock: () => [] });
    expect(calls[0]).toBe(expected);
  });
});
