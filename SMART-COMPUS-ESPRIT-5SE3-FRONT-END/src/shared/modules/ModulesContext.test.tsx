import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ModuleDef } from "@/shared/types/module";
import { canAccess, ModulesProvider, useModules } from "./ModulesContext";

const make = (id: ModuleDef["id"], roles: ModuleDef["roles"]) => ({ id, roles, path: `/${id}` }) as unknown as ModuleDef;
const modules = [make("users", ["admin"]), make("academic", ["student", "teacher", "admin"])];
const wrapper = ({ children }: { children: ReactNode }) => <ModulesProvider modules={modules}>{children}</ModulesProvider>;

describe("registre des modules", () => {
  it("canAccess respecte les rôles autorisés", () => {
    expect(canAccess(modules[0]!, "student")).toBe(false);
    expect(canAccess(modules[0]!, "admin")).toBe(true);
  });
  it("modulesForRole ne renvoie que les modules accessibles", () => {
    const { result } = renderHook(() => useModules(), { wrapper });
    expect(result.current.modulesForRole("student").map((m) => m.id)).toEqual(["academic"]);
  });
  it("getModule lève une erreur claire pour un module inconnu", () => {
    const { result } = renderHook(() => useModules(), { wrapper });
    expect(() => result.current.getModule("library")).toThrow(/Module inconnu/);
  });
  it("useModules exige son fournisseur", () => {
    expect(() => renderHook(() => useModules())).toThrow(/ModulesProvider/);
  });
});
