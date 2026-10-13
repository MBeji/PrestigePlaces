"use server";

import { saveSimulation, simulateScenario } from "@/lib/services";
import { run } from "@/components/params/actionResult";

/** Calcule une simulation (aucune écriture). Appelée pour chaque hypothèse proposée par l'assistant IA. */
export async function simulateAction(scenarioId: string, input: unknown) {
  return run(() => simulateScenario(scenarioId, input));
}

/** Enregistre une simulation comme nouveau scénario (brouillon). */
export async function saveSimulationAction(scenarioId: string, name: string, hypotheses: unknown) {
  const r = await run(() => saveSimulation(scenarioId, { name, hypotheses: hypotheses as never }));
  return r.ok ? { ok: true as const, message: `Scénario « ${r.data.name} » enregistré.`, id: r.data.id } : r;
}
