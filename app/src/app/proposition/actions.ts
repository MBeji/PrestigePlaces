"use server";

import { runProposal, setScenarioStatus } from "@/lib/services";
import { run } from "@/components/params/actionResult";

export async function calculateAction(scenarioId: string) {
  const r = await run(() => runProposal(scenarioId));
  return r.ok ? { ok: true as const, message: `Proposition calculée : ${r.data.kpis.changes} positions changent de direction.`, id: r.data.scenarioId } : r;
}

/** Valide la proposition (scénario dérivé) : PROPOSED -> VALIDATED. */
export async function validateAction(proposalScenarioId: string) {
  return run(() => setScenarioStatus(proposalScenarioId, { status: "VALIDATED" }), "Proposition validée.");
}
