import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import { PasswordStrength, scorePassword } from "./PasswordStrength";

describe("scorePassword", () => {
  it.each([
    ["", 0],
    ["abc", 1],
    ["Abcdefg1", 2],
    ["Abcdefg1xyzw", 3],
    ["Abcdefg1xyz!", 4],
  ])("« %s » vaut %i", (pw, score) => {
    expect(scorePassword(pw)).toBe(score);
  });
});

describe("<PasswordStrength />", () => {
  it("expose une jauge accessible dont la valeur suit le mot de passe", () => {
    renderWithProviders(<PasswordStrength password="Abcdefg1xyz!" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "4");
  });
});
