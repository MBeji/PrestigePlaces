import { expect, test } from "@playwright/test";

test("l'import refuse un fichier invalide", async ({ page }) => {
  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Import de l'effectif RH" })).toBeVisible();
  await page.getByLabel("Fichier d'extraction RH").setInputFiles({
    name: "extraction.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("colonne;autre\nfoo;bar\n", "utf8"),
  });
  await page.getByRole("button", { name: "Prévisualiser les écarts" }).click();
  // (le filtre écarte l'annonceur de route de Next, lui aussi en role="alert")
  const alert = page.getByRole("alert").filter({ hasText: /\S/ });
  await expect(alert).toBeVisible();
  await expect(page.getByRole("heading", { name: "Écarts avec le dernier import" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Confirmer l'import/ })).toHaveCount(0);
});

test("l'import est refusé au rôle lecture seule", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/connexion?callbackUrl=%2Fimport");
  await page.getByRole("radio", { name: "Lecture seule" }).check();
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/import/);
  await expect(page.getByRole("alert").filter({ hasText: "Vous n'avez pas le droit d'importer" })).toBeVisible();
  await expect(page.getByLabel("Fichier d'extraction RH")).toHaveCount(0);
  // La navigation masque le lien Import et affiche le rôle courant.
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav.getByRole("link", { name: "Import" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Lecture seule" })).toBeVisible();
  await context.close();
});
