import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAuth } from "@/shared/auth/AuthContext";
import { DEMO_USERS } from "@/shared/auth/roles";
import { AuthProvider } from "./AuthProvider";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("session (AuthProvider)", () => {
  it("démarre sans session, avec le profil de démonstration étudiant", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.role).toBe("student");
  });

  it("ouvre puis ferme une session, et la persiste", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login(DEMO_USERS.admin));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe("admin");
    expect(localStorage.getItem("smartcampus.session")).toContain(DEMO_USERS.admin.id);

    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("smartcampus.session")).toBeNull();
  });

  it("restaure une session enregistrée au démarrage", () => {
    localStorage.setItem("smartcampus.session", JSON.stringify(DEMO_USERS.teacher));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe("teacher");
  });

  it("ignore une session corrompue", () => {
    localStorage.setItem("smartcampus.session", "{pas du json");
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
  });
});
