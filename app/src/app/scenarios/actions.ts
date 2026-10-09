"use server";

import { createScenario, duplicateScenario, setActiveScenario, setScenarioStatus } from "@/lib/services";
import { run } from "@/components/params/actionResult";

export async function createScenarioAction(input: { name: string; fromScenarioId?: string }) {
  return run(() => createScenario({ name: input.name, fromScenarioId: input.fromScenarioId || undefined }), "Scénario créé.");
}
export async function duplicateScenarioAction(id: string) {
  return run(() => duplicateScenario(id), "Scénario dupliqué.");
}
export async function setStatusAction(id: string, status: "DRAFT" | "PROPOSED" | "VALIDATED" | "PUBLISHED") {
  return run(() => setScenarioStatus(id, { status }), "Statut modifié.");
}
export async function activateAction(id: string) {
  return run(() => setActiveScenario(id), "Scénario activé.");
}
