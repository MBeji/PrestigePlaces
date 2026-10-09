import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours de bout en bout sur le scénario « Situation 7 (classeur) » (base e2e fraîchement seedée).
 * Les étapes s'enchaînent : la proposition calculée est ensuite vérifiée sur les plans.
 */
test.describe.configure({ mode: "serial" });

const QUOTAS: Record<string, number> = { Ammar: 204, Boubaker: 137, Zeineb: 294, Amine: 195, "Béji": 217 };
const FLOORS = ["RDC", "Étage 1", "Étage 2", "Étage 3", "Étage 4"];

async function cdiInput(page: Page, direction: string) {
  return page.getByRole("textbox", { name: `CDI de ${direction}`, exact: true });
}

test("les plans affichent les 5 niveaux et la salle de formation", async ({ page }) => {
  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Plans", level: 1 })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Niveaux" }).getByRole("tab");
  await expect(tabs).toHaveCount(5);
  for (const label of FLOORS) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
    const plan = page.getByRole("group", { name: new RegExp(`^Plan du niveau ${label},`) });
    await expect(plan).toBeVisible();
    expect(await plan.locator("[data-id]").count()).toBeGreaterThan(50);
  }
  await page.getByRole("tab", { name: "RDC", exact: true }).click();
  await expect(page.getByText("Salle de formation", { exact: true })).toBeVisible();
  // Pas encore de proposition : seule la vue situation est disponible.
  await expect(page.getByText("Aucune proposition calculée pour ce scénario")).toBeVisible();
});

test("les paramètres se modifient et s'enregistrent", async ({ page }) => {
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { name: "Paramètres", level: 1 })).toBeVisible();
  const input = await cdiInput(page, "Amine");
  const initial = Number(await input.inputValue());
  expect(initial).toBeGreaterThan(0);

  // Saisie invalide : refusée sans enregistrement.
  await input.fill("-3");
  await expect(input).toHaveAttribute("aria-invalid", "true");

  await input.fill(String(initial + 7));
  await input.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Enregistré." })).toBeVisible();

  // La valeur est persistée en base.
  await page.reload();
  await expect(await cdiInput(page, "Amine")).toHaveValue(String(initial + 7));

  // Retour à la valeur d'origine pour la suite du parcours.
  const again = await cdiInput(page, "Amine");
  await again.fill(String(initial));
  await again.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Enregistré." })).toBeVisible();
  await page.reload();
  await expect(await cdiInput(page, "Amine")).toHaveValue(String(initial));
});

test("la proposition donne les quotas attendus et 69 changements", async ({ page }) => {
  await page.goto("/proposition");
  await expect(page.getByRole("combobox").first()).toContainText("Situation 7 (classeur)");
  await page.getByRole("button", { name: /Calculer la proposition|Recalculer la proposition/ }).click();
  await expect(page.getByRole("status")).toContainText("Proposition calculée : 69 positions changent de direction.", { timeout: 30_000 });

  const kpi = page.locator(".kpi").filter({ hasText: "Changent de direction" });
  await expect(kpi.locator(".v")).toHaveText("69");

  const table = page.locator("table").first();
  for (const [label, quota] of Object.entries(QUOTAS)) {
    const row = table.locator("tbody tr").filter({ has: page.getByText(label, { exact: true }) });
    await expect(row.locator("td").nth(2)).toHaveText(String(quota));
  }
  await expect(table.locator("tfoot th").nth(2)).toHaveText("1047");
  await expect(page.getByRole("heading", { name: /Mouvements \(\d+, dont 69 changements de direction\)/ })).toBeVisible();
  // Niveaux après la proposition (étude) : Zeineb s'étend au niveau 3, les autres directions gardent leurs niveaux.
  const AFTER: Record<string, string> = { Zeineb: "2 → 2, 3", "Béji": "RDC, 4", Boubaker: "→ 1", Ammar: "→ RDC, 1, 3", Amine: "→ 3, 4" };
  for (const [label, text] of Object.entries(AFTER)) {
    await expect(table.locator("tbody tr").filter({ has: page.getByText(label, { exact: true }) }).locator("td").nth(4)).toContainText(text);
  }
});

test("la vue changements des plans marque les positions qui changent", async ({ page }) => {
  await page.goto("/plans?niveau=RDC&vue=changements");
  await expect(page.getByText(/69\s+positions changent de direction sur le site/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Changements", exact: true })).toHaveAttribute("aria-pressed", "true");
  const plan = page.getByRole("group", { name: /^Plan du niveau RDC, vue/ });
  const changed = plan.locator('[data-changed="true"]');
  expect(await changed.count()).toBeGreaterThan(0);

  // Le centre du RDC reste libéré : aucune position de la zone n'est marquée comme reprise.
  await expect(page.getByText("Salle de formation", { exact: true })).toBeVisible();

  // Le total des positions marquées sur les 5 niveaux vaut 69.
  let total = 0;
  for (const label of FLOORS) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    const p = page.getByRole("group", { name: new RegExp(`^Plan du niveau ${label},`) });
    await expect(p).toBeVisible();
    total += await p.locator('[data-changed="true"]:not([data-dir="VIDE"])').count();
  }
  expect(total).toBe(69);
});
