import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Vue 3D (connexion « Services généraux », fichier de session du projet chromium).
 * Les assertions ne dépendent jamais du contenu du canvas : en headless, WebGL peut tomber en rendu logiciel
 * (SwiftShader), voire être indisponible ; seuls la présence de la scène, les étiquettes HTML et les tableaux
 * sont vérifiés.
 */

/** Totaux de référence (situation → proposition) sur « Situation 7 (classeur) ». */
const TOTALS: Record<string, string> = { Ammar: "251 → 204", Zeineb: "259 → 294", "Béji": "184 → 217" };

/** Garantit qu'une proposition existe pour le scénario par défaut (le test reste autonome hors du parcours). */
async function ensureProposal(page: Page) {
  await page.goto("/vue-3d");
  if (await page.getByText("Aucune proposition calculée pour ce scénario").isVisible()) {
    await page.goto("/proposition");
    await page.getByRole("button", { name: /Calculer la proposition|Recalculer la proposition/ }).click();
    await expect(page.getByRole("status")).toContainText("Proposition calculée", { timeout: 30_000 });
    await page.goto("/vue-3d");
  }
}

/** Cellule de la ligne `row` dans la colonne dont l'en-tête vaut `header`. */
async function cell(table: Locator, row: Locator, header: string) {
  const headers = (await table.locator("thead th").allInnerTexts()).map((t) => t.trim());
  const index = headers.indexOf(header);
  expect(index, `colonne « ${header} » absente : ${headers.join(" | ")}`).toBeGreaterThan(0);
  return row.locator("th, td").nth(index);
}

test("la vue 3D affiche le tableau par niveau et les open spaces", async ({ page }) => {
  await page.goto("/vue-3d");
  await expect(page.getByRole("heading", { name: "Vue 3D", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Vue 3D" })).toHaveAttribute("aria-current", "page");

  const table = page.getByRole("table", { name: "Positions par niveau et par direction" });
  await expect(table).toBeVisible();
  for (const label of ["Étage 4", "Étage 3", "Étage 2", "Étage 1", "RDC", "Total"]) await expect(table.getByRole("rowheader", { name: label, exact: true })).toBeVisible();
  await expect(table.getByRole("row", { name: /^Total/ })).toContainText("1153");

  await expect(page.locator("canvas").or(page.getByText("Vue 3D indisponible"))).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open spaces (tous niveaux, par taille)" })).toBeVisible();

  await page.getByRole("button", { name: "RDC", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open spaces · RDC" })).toBeVisible();
  await expect(page).toHaveURL(/niveau=RDC/);
});

test("services généraux : totaux par direction avant → après et canvas 3D présent", async ({ page }) => {
  await ensureProposal(page);
  await expect(page.getByRole("heading", { name: "Vue 3D", level: 1 })).toBeVisible();
  await expect(page.getByText(/69\s+positions changent de direction sur le site/)).toBeVisible();

  const table = page.getByRole("table", { name: "Positions par niveau et par direction" });
  await expect(table).toBeVisible();
  const total = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Total", exact: true }) });
  await expect(total).toHaveCount(1);
  for (const [direction, expected] of Object.entries(TOTALS)) {
    await expect(await cell(table, total, direction)).toHaveText(expected, { useInnerText: true });
  }
  await expect(await cell(table, total, "Total")).toHaveText("1153");

  // La scène Three.js est montée : un canvas dans la zone « Vue 3D du site » (contenu non vérifié).
  const scene = page.getByRole("img", { name: /^Vue 3D du site, tous les niveaux/ });
  await expect(scene).toBeVisible();
  const canvas = scene.locator("canvas");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);
  await expect(page.getByText("Vue 3D indisponible")).toHaveCount(0);
  // Étiquettes HTML projetées (indépendantes du rendu WebGL) : une par niveau en vue « tous les niveaux ».
  await expect(scene.getByText(/^Étage 4 · \d+ positions$/)).toBeVisible();
});
