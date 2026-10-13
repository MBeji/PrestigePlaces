import { getFloorPlan, getOverview, getScenarioParams, listFloors } from "@/lib/services";
import { prisma } from "@/lib/db";
import { mergeFloorPlans, SUPPORT, type DirectionStyle, type FloorPlanData } from "@/components/plan/model";
import type { AssistantContext } from "@/lib/ai/assistant";

export interface AiPageData {
  context: AssistantContext;
  floors: FloorPlanData[];
  directions: DirectionStyle[];
}

const ORDER = ["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI", "SUPPORT"];

/** Données de la page Scénarios IA : contexte chiffré pour l'assistant et plans du scénario de départ. */
export async function loadAiPage(scenarioId: string): Promise<AiPageData> {
  const [o, floorInfos, params, dirRows] = await Promise.all([
    getOverview(scenarioId),
    listFloors(),
    getScenarioParams(scenarioId),
    prisma.direction.findMany({ select: { code: true, label: true, color: true, inEquation: true } }),
  ]);
  const extra = params.extraZones.map((z) => z.positionId);
  const floors = (await Promise.all(floorInfos.map((f) => getFloorPlan(f.code, scenarioId)))).map((p) => mergeFloorPlans(p, null, extra));
  const byFloor: Record<string, Record<string, number>> = {};
  for (const f of floors) {
    const m: Record<string, number> = {};
    for (const p of f.positions) {
      if (p.zoneToFree || p.extraZone || p.groupCode === "SUP" || p.current === SUPPORT) continue;
      m[p.current] = (m[p.current] ?? 0) + 1;
    }
    byFloor[f.code] = m;
  }
  return {
    context: {
      scenarioName: o.scenarioName,
      reservePct: o.reservePct,
      recruitWindowMonths: o.recruitWindowMonths,
      directions: o.rows.map((r) => ({ code: r.code, label: r.label, cdi: r.cdi, externes: r.externes, recrutements: r.recrutements, fixedSeats: r.fixedSeats, current: r.current, quota: r.quota })),
      totals: { positions: o.totalPositions, support: o.supportPositions, zoneToFree: o.zonePositions, pool: o.poolPositions, allocated: o.allocated },
      byFloor,
    },
    floors,
    directions: [...dirRows].sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code)),
  };
}
