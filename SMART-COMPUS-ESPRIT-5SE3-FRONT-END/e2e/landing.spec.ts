import { expect, test } from "@playwright/test";

test.describe("page d'accueil publique", () => {
  test("affiche le titre, les services et mène à la connexion", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Votre campus");
    await expect(page.getByRole("heading", { name: "Six services pour tout le campus" })).toBeVisible();
    await page.getByRole("link", { name: "Se connecter" }).first().click();
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test("ne déborde jamais horizontalement", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("sans session, une page protégée redirige vers la connexion", async ({ page }) => {
    await page.goto("/academique");
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
