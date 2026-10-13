import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { directionParamsFromSituation, loadSeatsFromSituation, VIDE, type SituationJson } from "@/lib/engine";
import { describeHypotheses, freedSeatIds, simulate, simulationInputSchema, summarizeForAssistant } from "./simulation";

const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/situation.json", import.meta.url)), "utf8")) as SituationJson;
const seats = loadSeatsFromSituation(json);
const base = { directions: directionParamsFromSituation(json), reservePct: 0 };

describe("simulate", () => {
  it("sans hypothèse modifiée, retrouve les quotas de référence", () => {
    const r = simulate(seats, base, { titre: "Référence" });
    expect(Object.fromEntries(r.rows.map((x) => [x.code, x.quotaAfter]))).toEqual({ AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217 });
    expect(r.rows.every((x) => x.quotaAfter === x.quotaBefore)).toBe(true);
    expect(r.kpis.changes).toBe(69);
    expect(r.hypotheses).toEqual([]);
  });

  it("des recrutements supplémentaires augmentent le quota de la direction", () => {
    const amine = base.directions.find((d) => d.code === "AMINE")!;
    const r = simulate(seats, base, { titre: "AMINE recrute", directions: [{ code: "AMINE", recrutements: amine.recrutements + 40 }] });
    const row = r.rows.find((x) => x.code === "AMINE")!;
    expect(row.quotaAfter).toBeGreaterThan(row.quotaBefore);
    expect(row.targetAfter - row.targetBefore).toBe(40);
    expect(r.rows.reduce((s, x) => s + x.quotaAfter, 0)).toBe(r.kpis.positionsToAllocate);
    expect(r.hypotheses[0]).toMatch(/^AMINE : recrutements .* \(\+40\)$/);
  });

  it("une réserve réduit les positions à répartir", () => {
    const r = simulate(seats, base, { titre: "Réserve", reservePct: 5 });
    expect(r.kpis.reserve).toBeGreaterThan(0);
    expect(r.kpis.positionsToAllocate).toBe(r.kpis.positionsToAllocateBefore - r.kpis.reserve);
  });

  it("un niveau libéré sort du pool sans toucher support ni postes fixes", () => {
    const freed = freedSeatIds(seats, ["4"]);
    expect(freed.length).toBeGreaterThan(0);
    const byId = new Map(seats.map((s) => [s.id, s]));
    expect(freed.every((id) => !(byId.get(id)!.fixed && byId.get(id)!.direction !== VIDE) && byId.get(id)!.groupCode !== "SUP")).toBe(true);
    const r = simulate(seats, base, { titre: "Niveau 4 libéré", niveauxALiberer: ["4"] });
    expect(r.freedPositions).toBe(freed.length);
    expect(r.kpis.positionsToAllocate).toBeLessThan(r.kpis.positionsToAllocateBefore);
    for (const id of freed) expect(r.changed[id] ?? byId.get(id)!.direction).toBe(VIDE);
    // Un poste fixe vide peut être repris (règle du moteur) ; occupé, il ne bouge jamais.
    for (const s of seats) if (s.groupCode === "SUP" || (s.fixed && s.direction !== VIDE)) expect(r.changed[s.id]).toBeUndefined();
  });

  it("refuse une direction ou un niveau inconnus", () => {
    expect(simulationInputSchema.safeParse({ titre: "x", directions: [{ code: "SUPPORT", cdi: 3 }] }).success).toBe(false);
    expect(simulationInputSchema.safeParse({ titre: "x", niveauxALiberer: ["5"] }).success).toBe(false);
    expect(simulationInputSchema.safeParse({ titre: "x", reservePct: 80 }).success).toBe(false);
  });

  it("décrit les hypothèses et résume les chiffres pour l'assistant", () => {
    expect(describeHypotheses(base, { titre: "x", reservePct: 3, niveauxALiberer: ["RDC", "2"] })).toEqual(["Réserve : 0 % → 3 %", "Niveaux libérés : RDC, niveau 2"]);
    const s = summarizeForAssistant(simulate(seats, base, { titre: "Résumé" }));
    expect(s.directions).toHaveLength(5);
    expect(s.positionsQuiChangentDeDirection).toBe(69);
  });
});
