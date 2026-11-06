import { expect, test } from "@playwright/test";

test("connexion de démonstration (étudiant) puis accès au tableau de bord", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Étudiant" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour");
});
