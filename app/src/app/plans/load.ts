import { prisma } from "@/lib/db";
import { getFloorPlan, getScenarioParams, listFloors, listScenarios } from "@/lib/services";
import { mergeFloorPlans, type DirectionStyle, type FloorPlanData } from "@/components/plan/model";
import type { ScenarioOption } from "@/components/plan/PlanViewer";

export interface PlansPageData {
  scenarios: ScenarioOption[];
  scenarioId: string;
  proposal: { id: string; name: string; status: string } | null;
  floors: FloorPlanData[];
  directions: DirectionStyle[];
}

const DIRECTION_ORDER = ["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI", "SUPPORT"];

/**
 * Charge les plans des 5 niveaux pour un scénario source (défaut : scénario actif) et sa proposition
 * (scénario dérivé le plus récent). Si l'identifiant donné est une proposition, on remonte à son source.
 * Renvoie null s'il n'existe aucun scénario.
 */
export async function loadPlansPage(requestedId?: string): Promise<PlansPageData | null> {
  const [all, floorInfos, dirRows] = await Promise.all([
    listScenarios(),
    listFloors(),
    prisma.direction.findMany({ select: { code: true, label: true, color: true, inEquation: true } }),
  ]);
  const sources = all.filter((s) => !s.parentId);
  if (!sources.length) return null;

  const requested = requestedId ? all.find((s) => s.id === requestedId) : undefined;
  const source =
    (requested?.parentId ? sources.find((s) => s.id === requested.parentId) : requested && !requested.parentId ? requested : undefined) ??
    sources.find((s) => s.isActive) ??
    sources[0];
  // listScenarios est trié du plus récent au plus ancien : la première dérivée est la plus récente.
  const derived = all.find((s) => s.parentId === source.id) ?? null;

  const [situations, proposals, params] = await Promise.all([
    Promise.all(floorInfos.map((f) => getFloorPlan(f.code, source.id))),
    derived ? Promise.all(floorInfos.map((f) => getFloorPlan(f.code, derived.id))) : Promise.resolve(null),
    getScenarioParams(source.id),
  ]);
  const extraZones = params.extraZones.map((z) => z.positionId);

  const directions = [...dirRows].sort((a, b) => rank(a.code) - rank(b.code));
  return {
    scenarios: sources.map((s) => ({ id: s.id, name: s.name, status: s.status, isActive: s.isActive, hasProposal: all.some((d) => d.parentId === s.id) })),
    scenarioId: source.id,
    proposal: derived ? { id: derived.id, name: derived.name, status: derived.status } : null,
    floors: situations.map((sit, i) => mergeFloorPlans(sit, proposals?.[i] ?? null, extraZones)),
    directions,
  };
}

function rank(code: string): number {
  const i = DIRECTION_ORDER.indexOf(code);
  return i < 0 ? DIRECTION_ORDER.length : i;
}
