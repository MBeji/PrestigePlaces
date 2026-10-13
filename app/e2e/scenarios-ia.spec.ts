import { expect, test, type Route } from "@playwright/test";

/**
 * Scénarios IA : l'API Claude est simulée (aucun appel réseau réel, aucune clé). Premier appel : le modèle demande
 * la simulation « AMINE +40 recrutements » ; second appel : il commente. On vérifie que la clé reste dans le
 * navigateur, que le scénario est dessiné avec ses chiffres et qu'il s'enregistre comme nouveau scénario.
 */
function sse(events: object[]): string {
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}
const start = (id: string) => ({
  type: "message_start",
  message: { id, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } },
});

test("un prompt produit un scénario chiffré et dessiné, enregistrable", async ({ page }) => {
  const calls: { headers: Record<string, string>; body: { messages: unknown[]; tools: { name: string }[] } }[] = [];
  await page.route("https://api.anthropic.com/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } });
    const body = req.postDataJSON();
    calls.push({ headers: req.headers(), body });
    const first = calls.length === 1;
    const events = first
      ? [
          start("msg_1"),
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Je calcule le scénario." } },
          { type: "content_block_stop", index: 0 },
          { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "simuler_scenario", input: {} } },
          { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify({ titre: "AMINE +40 recrutements", directions: [{ code: "AMINE", recrutements: 400 }] }) } },
          { type: "content_block_stop", index: 1 },
          { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 40 } },
          { type: "message_stop" },
        ]
      : [
          start("msg_2"),
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Le quota d'AMINE augmente." } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 10 } },
          { type: "message_stop" },
        ];
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse(events) });
  });

  await page.goto("/scenarios-ia");
  await expect(page.getByRole("heading", { name: "Scénarios IA", level: 1 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Votre demande" })).toBeDisabled();

  await page.getByRole("textbox", { name: "Clé API Claude" }).fill("sk-ant-test-0000000000");
  await page.getByRole("button", { name: "Utiliser cette clé" }).click();
  await expect(page.getByText(/Clé enregistrée sur ce navigateur/)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("prestigeplaces.ia.cle"))).toBe("sk-ant-test-0000000000");

  await page.getByRole("textbox", { name: "Votre demande" }).fill("AMINE recrute 40 personnes de plus");
  await page.getByRole("button", { name: "Simuler" }).click();

  const card = page.getByRole("article", { name: "Scénario AMINE +40 recrutements" });
  await expect(card).toBeVisible();
  await expect(card.getByText(/^AMINE : recrutements \d+ → 400 \(\+\d+\)$/)).toBeVisible();
  await expect(card.getByRole("img", { name: /^AMINE : quota 195 avant, \d+ simulé/ })).toBeVisible();
  await expect(card.getByRole("group", { name: /^Plan du niveau / })).toBeVisible();
  await expect(page.getByText("Le quota d'AMINE augmente.")).toBeVisible();

  // La clé part directement vers l'API Claude, avec l'outil de simulation ; le second appel porte le résultat calculé.
  expect(calls).toHaveLength(2);
  expect(calls[0].headers["x-api-key"]).toBe("sk-ant-test-0000000000");
  expect(calls[0].body.tools.map((t) => t.name)).toEqual(["simuler_scenario"]);
  expect(JSON.stringify(calls[1].body.messages)).toContain("positionsQuiChangentDeDirection");

  await card.getByRole("button", { name: "Enregistrer comme scénario" }).click();
  await expect(card.getByText(/Scénario « IA – AMINE \+40 recrutements » enregistré/)).toBeVisible();
});
