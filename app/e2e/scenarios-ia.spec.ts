import { expect, test, type Route } from "@playwright/test";

/**
 * Scénarios IA : le proxy LLM (format compatible OpenAI) est simulé (aucun appel réseau réel, aucune clé). Premier
 * appel : le modèle demande la simulation « AMINE +40 recrutements » ; second appel : il commente. On vérifie que la
 * clé reste dans le navigateur, que le scénario est dessiné avec ses chiffres et qu'il s'enregistre comme nouveau scénario.
 */
const PROXY = "https://proxy-llm.test/v1";
function sse(chunks: object[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
}
const chunk = (delta: object, finish_reason: string | null = null) => ({ id: "c", object: "chat.completion.chunk", model: "modele-test", choices: [{ index: 0, delta, finish_reason }] });

test("un prompt produit un scénario chiffré et dessiné, enregistrable", async ({ page }) => {
  const calls: { url: string; headers: Record<string, string>; body: { model: string; messages: unknown[]; tools: { function: { name: string } }[] } }[] = [];
  await page.route(`${PROXY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } });
    const body = req.postDataJSON();
    calls.push({ url: req.url(), headers: req.headers(), body });
    const args = JSON.stringify({ titre: "AMINE +40 recrutements", directions: [{ code: "AMINE", recrutements: 400 }] });
    const chunks =
      calls.length === 1
        ? [
            chunk({ role: "assistant", content: "Je calcule le scénario." }),
            chunk({ tool_calls: [{ index: 0, id: "appel_1", type: "function", function: { name: "simuler_scenario", arguments: "" } }] }),
            chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(0, 20) } }] }),
            chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(20) } }] }),
            chunk({}, "tool_calls"),
          ]
        : [chunk({ role: "assistant", content: "Le quota d'AMINE " }), chunk({ content: "augmente." }), chunk({}, "stop")];
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse(chunks) });
  });

  await page.goto("/scenarios-ia");
  await expect(page.getByRole("heading", { name: "Scénarios IA", level: 1 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Votre demande" })).toBeDisabled();

  await expect(page.getByText(/Claude|Anthropic/)).toHaveCount(0);
  await page.getByRole("textbox", { name: "URL du proxy" }).fill(PROXY);
  await page.getByRole("textbox", { name: "Nom du modèle" }).fill("modele-test");
  await page.getByRole("textbox", { name: "LLM Proxy Clé" }).fill("cle-test-0000000000");
  await page.getByRole("button", { name: "Utiliser cette clé" }).click();
  await expect(page.getByText(/Clé enregistrée sur ce navigateur/)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("prestigeplaces.ia.cle"))).toBe("cle-test-0000000000");

  await page.getByRole("textbox", { name: "Votre demande" }).fill("AMINE recrute 40 personnes de plus");
  await page.getByRole("button", { name: "Simuler" }).click();

  const card = page.getByRole("article", { name: "Scénario AMINE +40 recrutements" });
  await expect(card).toBeVisible();
  await expect(card.getByText(/^AMINE : recrutements \d+ → 400 \(\+\d+\)$/)).toBeVisible();
  await expect(card.getByRole("img", { name: /^AMINE : quota 195 avant, \d+ simulé/ })).toBeVisible();
  await expect(card.getByRole("group", { name: /^Plan du niveau / })).toBeVisible();
  await expect(page.getByText("Le quota d'AMINE augmente.")).toBeVisible();

  // La clé part directement vers le proxy indiqué, avec l'outil de simulation ; le second appel porte le résultat calculé.
  expect(calls).toHaveLength(2);
  expect(calls[0].url).toBe(`${PROXY}/chat/completions`);
  expect(calls[0].headers["authorization"]).toBe("Bearer cle-test-0000000000");
  expect(calls[0].body.model).toBe("modele-test");
  expect(calls[0].body.tools.map((t) => t.function.name)).toEqual(["simuler_scenario"]);
  expect(JSON.stringify(calls[1].body.messages)).toContain("positionsQuiChangentDeDirection");

  await card.getByRole("button", { name: "Enregistrer comme scénario" }).click();
  await expect(card.getByText(/Scénario « IA – AMINE \+40 recrutements » enregistré/)).toBeVisible();
});
