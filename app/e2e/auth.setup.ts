import { expect, test as setup } from "@playwright/test";

const STATE = "e2e/.auth/services-generaux.json";

setup("connexion en services généraux (mode développement)", async ({ page }) => {
  // Sans session, une page protégée renvoie vers /connexion avec le callbackUrl.
  await page.goto("/plans");
  await expect(page).toHaveURL(/\/connexion\?callbackUrl=%2Fplans/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();

  await page.getByRole("radio", { name: "Services généraux" }).check();
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/plans/);

  await page.goto("/connexion");
  await expect(page.getByTestId("session-courante")).toContainText("Services généraux");
  await page.context().storageState({ path: STATE });
});
