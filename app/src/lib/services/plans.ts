import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { notFound } from "./errors";

export interface FloorInfo { code: string; label: string; ord: number; positions: number; islands: number }
export interface PlanCellView { r: number; c: number; type: string }
export interface PositionView {
  id: string; r: number; c: number; kind: string; type: string; groupCode: string; reserved: boolean; zoneToFree: boolean;
  /** Index d'îlot en base (0..n-1). */
  islandIndex: number | null;
  /** Direction affectée dans le scénario (VIDE si aucune affectation, ZONE_A_LIBERER pour la zone à libérer). */
  directionCode: string;
  /** Mouvement du scénario pour cette position (propositions). */
  movement: { from: string; to: string } | null;
}
export interface FloorPlanView { floor: FloorInfo; scenarioId: string | null; cells: PlanCellView[]; positions: PositionView[] }
export interface AssignmentSummary {
  scenarioId: string;
  /** Nombre de positions par direction (VIDE comprise, zone à libérer exclue). */
  byDirection: Record<string, number>;
  /** Nombre de positions par niveau et par direction. */
  byFloor: Record<string, Record<string, number>>;
  zoneToFree: number;
  total: number;
}

async function resolveScenarioId(scenarioId?: string | null): Promise<string | null> {
  if (scenarioId) {
    const s = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { id: true } });
    if (!s) throw notFound("Scénario");
    return s.id;
  }
  const active = await prisma.scenario.findFirst({ where: { isActive: true }, select: { id: true } });
  return active?.id ?? null;
}

/** Niveaux du site avec nombre de positions et d'îlots. Droit : lire. */
export async function listFloors(): Promise<FloorInfo[]> {
  await requirePermission("lire");
  const floors = await prisma.floor.findMany({ orderBy: { ord: "asc" }, include: { _count: { select: { positions: true, islands: true } } } });
  return floors.map((f) => ({ code: f.code, label: f.label, ord: f.ord, positions: f._count.positions, islands: f._count.islands }));
}

/**
 * Plan d'un niveau : cellules, positions et affectations du scénario (défaut : scénario actif).
 * Pour une proposition, les positions portent aussi leur mouvement.
 */
export async function getFloorPlan(floorCode: string, scenarioId?: string | null): Promise<FloorPlanView> {
  await requirePermission("lire");
  const floor = await prisma.floor.findFirst({ where: { code: floorCode }, include: { _count: { select: { positions: true, islands: true } } } });
  if (!floor) throw notFound(`Niveau ${floorCode}`);
  const sid = await resolveScenarioId(scenarioId);
  const [cells, positions, assigns, moves] = await Promise.all([
    prisma.planCell.findMany({ where: { floorId: floor.id }, select: { r: true, c: true, type: true }, orderBy: [{ r: "asc" }, { c: "asc" }] }),
    prisma.position.findMany({ where: { floorId: floor.id }, include: { island: { select: { index: true } } }, orderBy: [{ r: "asc" }, { c: "asc" }] }),
    sid ? prisma.assignment.findMany({ where: { scenarioId: sid, position: { floorId: floor.id } }, select: { positionId: true, directionCode: true } }) : [],
    sid ? prisma.movement.findMany({ where: { scenarioId: sid, position: { floorId: floor.id } }, select: { positionId: true, fromDirection: true, toDirection: true } }) : [],
  ]);
  const dir = new Map(assigns.map((a) => [a.positionId, a.directionCode]));
  const mov = new Map(moves.map((m) => [m.positionId, { from: m.fromDirection, to: m.toDirection }]));
  return {
    floor: { code: floor.code, label: floor.label, ord: floor.ord, positions: floor._count.positions, islands: floor._count.islands },
    scenarioId: sid,
    cells,
    positions: positions.map((p) => ({
      id: p.id, r: p.r, c: p.c, kind: p.kind, type: p.type, groupCode: p.groupCode, reserved: p.reserved, zoneToFree: p.zoneToFree,
      islandIndex: p.island?.index ?? null,
      directionCode: p.zoneToFree ? "ZONE_A_LIBERER" : (dir.get(p.id) ?? "VIDE"),
      movement: mov.get(p.id) ?? null,
    })),
  };
}

/** Comptes par direction et par niveau des affectations d'un scénario. Droit : lire. */
export async function getAssignmentSummary(scenarioId: string): Promise<AssignmentSummary> {
  await requirePermission("lire");
  const sid = await resolveScenarioId(scenarioId);
  const positions = await prisma.position.findMany({ select: { id: true, zoneToFree: true, floor: { select: { code: true } } } });
  const assigns = await prisma.assignment.findMany({ where: { scenarioId: sid! }, select: { positionId: true, directionCode: true } });
  const dir = new Map(assigns.map((a) => [a.positionId, a.directionCode]));
  const byDirection: Record<string, number> = {};
  const byFloor: Record<string, Record<string, number>> = {};
  let zone = 0;
  for (const p of positions) {
    if (p.zoneToFree) { zone++; continue; }
    const d = dir.get(p.id) ?? "VIDE";
    byDirection[d] = (byDirection[d] ?? 0) + 1;
    const f = (byFloor[p.floor.code] ??= {});
    f[d] = (f[d] ?? 0) + 1;
  }
  return { scenarioId: sid!, byDirection, byFloor, zoneToFree: zone, total: positions.length - zone };
}
