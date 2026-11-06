import { describe, expect, it } from "vitest";
import { cn, initials } from "./utils";

describe("cn", () => {
  it("fusionne les classes Tailwind en conflit (la dernière gagne)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
  it("ignore les valeurs fausses", () => {
    const disabled = Boolean(0);
    expect(cn("a", disabled && "b", undefined, "c")).toBe("a c");
  });
});

describe("initials", () => {
  it("prend la première lettre des deux premiers mots, en majuscules", () => {
    expect(initials("farah yaich")).toBe("FY");
  });
});
