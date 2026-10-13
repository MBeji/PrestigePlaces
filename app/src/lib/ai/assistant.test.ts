import { afterEach, describe, expect, it, vi } from "vitest";
import { completionsUrl, describeApiError, LlmHttpError, runAssistantTurn, type AssistantContext, type ChatMessage } from "./assistant";

const ctx: AssistantContext = {
  scenarioName: "Départ",
  reservePct: 0,
  recruitWindowMonths: 3,
  directions: [],
  totals: { positions: 0, support: 0, zoneToFree: 0, pool: 0, allocated: 0 },
  byFloor: {},
};
const cfg = { apiKey: "cle", baseUrl: "https://proxy.test/v1/", model: "modele" };

const sse = (chunks: object[]) =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });

afterEach(() => vi.unstubAllGlobals());

describe("assistant LLM compatible OpenAI", () => {
  it("construit l'URL des complétions", () => {
    expect(completionsUrl("https://proxy.test/v1/")).toBe("https://proxy.test/v1/chat/completions");
    expect(completionsUrl("https://proxy.test/v1/chat/completions")).toBe("https://proxy.test/v1/chat/completions");
  });

  it("exécute l'outil demandé en flux puis renvoie le résultat au modèle", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sse([
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "a1", function: { name: "simuler_scenario", arguments: '{"titre":' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"T"}' } }] }, finish_reason: "tool_calls" }] },
        ]),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Fini." }, finish_reason: "stop" }] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const history: ChatMessage[] = [{ role: "user", content: "Q" }];
    const texts: string[] = [];
    const simulate = vi.fn().mockResolvedValue({ summary: { ok: 1 } });
    await runAssistantTurn(cfg, ctx, history, { onTextStart: () => texts.push(""), onText: (d) => texts.push(d), simulate });

    expect(simulate).toHaveBeenCalledWith({ titre: "T" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://proxy.test/v1/chat/completions");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer cle");
    expect(history.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(history[2]).toEqual({ role: "tool", tool_call_id: "a1", content: '{"ok":1}' });
    expect(texts).toContain("Fini.");
  });

  it("traduit les erreurs HTTP sans nommer de fournisseur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })));
    const err = await runAssistantTurn(cfg, ctx, [], { onTextStart: () => {}, onText: () => {}, simulate: vi.fn() }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmHttpError);
    expect(describeApiError(err)).toBe("LLM Proxy Clé refusée : vérifiez la clé saisie.");
  });
});
