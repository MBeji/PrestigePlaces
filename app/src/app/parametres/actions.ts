"use server";

import { prisma } from "@/lib/db";
import {
  addExternal, addRecruitment, getDirectionParams, getScenarioParams, removeExternal, removeRecruitment,
  updateDirectionParams, updateScenarioParams, ServiceError,
} from "@/lib/services";
import { run } from "@/components/params/actionResult";

const REFERENCE_NAME = "Situation 7 (classeur)";

export async function saveDirectionAction(scenarioId: string, code: string, values: { cdi: number; externes: number; recrutements: number }) {
  return run(() => updateDirectionParams(scenarioId, code, values), "Enregistré.");
}

export async function addRecruitmentAction(
  scenarioId: string,
  input: { directionCode: string; count: number; source: "SIRH" | "MAIL_CLIENT"; expectedDate: string; reference?: string },
) {
  return run(() => addRecruitment(scenarioId, { ...input, reference: input.reference || null }), "Recrutement ajouté.");
}
export async function removeRecruitmentAction(scenarioId: string, id: string) {
  return run(() => removeRecruitment(scenarioId, id), "Recrutement supprimé.");
}
export async function addExternalAction(scenarioId: string, input: { directionCode: string; count: number; endDate?: string }) {
  return run(() => addExternal(scenarioId, { directionCode: input.directionCode, count: input.count, endDate: input.endDate ? new Date(input.endDate) : null }), "Consultants ajoutés.");
}
export async function removeExternalAction(scenarioId: string, id: string) {
  return run(() => removeExternal(scenarioId, id), "Consultants supprimés.");
}
export async function saveScenarioParamsAction(scenarioId: string, values: { reservePct: number; recruitWindowMonths: number }) {
  return run(() => updateScenarioParams(scenarioId, values), "Paramètres du scénario enregistrés.");
}

/** Recharge les valeurs du scénario d'origine (classeur) : totaux, lignes de recrutements et d'externes, réserve et fenêtre. */
export async function resetToWorkbookAction(scenarioId: string) {
  return run(async () => {
    const ref =
      (await prisma.scenario.findFirst({ where: { name: REFERENCE_NAME, parentId: null } })) ??
      (await prisma.scenario.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } }));
    if (!ref) throw new ServiceError(404, "INTROUVABLE", "Scénario d'origine introuvable.");
    if (ref.id === scenarioId) throw new ServiceError(409, "CONFLIT", "Ce scénario est déjà le scénario d'origine.");
    const [target, source, sourceScenario] = await Promise.all([getDirectionParams(scenarioId), getDirectionParams(ref.id), getScenarioParams(ref.id)]);
    await updateScenarioParams(scenarioId, { reservePct: sourceScenario.reservePct, recruitWindowMonths: sourceScenario.recruitWindowMonths });
    for (const t of target) {
      for (const r of t.recruitments) await removeRecruitment(scenarioId, r.id);
      for (const e of t.externals) await removeExternal(scenarioId, e.id);
      const s = source.find((x) => x.directionCode === t.directionCode);
      if (!s) continue;
      for (const r of s.recruitments)
        await addRecruitment(scenarioId, { directionCode: t.directionCode, poleCode: r.poleCode, count: r.count, source: r.source, expectedDate: r.expectedDate, reference: r.reference });
      for (const e of s.externals) await addExternal(scenarioId, { directionCode: t.directionCode, poleCode: e.poleCode, count: e.count, endDate: e.endDate });
      await updateDirectionParams(scenarioId, t.directionCode, { cdi: s.cdi, externes: s.externes, recrutements: s.recrutements });
    }
    return ref.name;
  }, "Valeurs du classeur rechargées.");
}
