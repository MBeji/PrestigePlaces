import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { allocationPool, seatsFromPositions, SUPPORT } from "@/lib/engine";
import { DIRECTIONS } from "@/lib/directions";
import { buildOverview, type Overview } from "@/lib/overview";
import { getDirectionParams } from "./directionParams";
import { notFound } from "./errors";

export interface OverviewView extends Overview {
  scenarioId: string;
  scenarioName: string;
  status: string;
  recruitWindowMonths: number;
  reservePct: number;
  /** Recrutements retenus par source (SIRH, mail client) et recrutements écartés (hors fenêtre). */
  recruitmentsBySource: { SIRH: number; MAIL_CLIENT: number; excluded: number };
  /** Positions qui changent de direction dans la dernière proposition calculée, ou null si aucune. */
  changes: number | null;
}

const EQUATION = DIRECTIONS.filter((d) => d.inEquation);

/**
 * Vue d'ensemble d'un scénario : paramètres agrégés du site, quotas recalculés avec la règle d'équité
 * (mêmes entrées que le moteur) et nombre de changements de la proposition si elle existe. Droit : lire.
 */
export async function getOverview(scenarioId: string): Promise<OverviewView> {
  await requirePermission("lire");
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw notFound("Scénario");
  const [params, positions, assignments, zones, derived] = await Promise.all([
    getDirectionParams(scenarioId),
    prisma.position.findMany({ select: { id: true, r: true, c: true, kind: true, groupCode: true, zoneToFree: true, reserved: true, floor: { select: { code: true } } } }),
    prisma.assignment.findMany({ where: { scenarioId }, select: { positionId: true, directionCode: true } }),
    prisma.scenarioZone.findMany({ where: { scenarioId }, select: { positionId: true } }),
    prisma.scenario.findFirst({ where: { parentId: scenarioId }, select: { kpis: true } }),
  ]);

  const seats = seatsFromPositions(positions, assignments);
  const extraZone = new Set(zones.map((z) => z.positionId));
  const isZone = (s: { id: string; zoneToFree: boolean }) => s.zoneToFree || extraZone.has(s.id);
  const pool = allocationPool(seats, EQUATION.map((d) => d.code), extraZone);
  const current = new Map<string, number>();
  for (const s of pool) current.set(s.direction, (current.get(s.direction) ?? 0) + 1);

  const overview = buildOverview({
    directions: EQUATION.map((d) => {
      const p = params.find((x) => x.directionCode === d.code);
      return {
        code: d.code, label: d.label, color: d.color,
        cdi: p?.cdi ?? 0, externes: p?.externes ?? 0, recrutements: p?.recrutements ?? 0, fixedSeats: p?.fixedSeats ?? 0,
        current: current.get(d.code) ?? 0,
      };
    }),
    totalPositions: seats.length,
    supportPositions: seats.filter((s) => !isZone(s) && (s.groupCode === "SUP" || s.direction === SUPPORT)).length,
    zonePositions: seats.filter(isZone).length,
    poolPositions: pool.length,
    reservePct: sc.reservePct,
  });

  const recruitmentsBySource = { SIRH: 0, MAIL_CLIENT: 0, excluded: 0 };
  for (const r of params.flatMap((p) => p.recruitments)) {
    if (r.counted) recruitmentsBySource[r.source] += r.count;
    else recruitmentsBySource.excluded += r.count;
  }
  const kpis = derived?.kpis as { kpis?: { changes?: number } } | null | undefined;

  return {
    ...overview,
    scenarioId: sc.id,
    scenarioName: sc.name,
    status: sc.status,
    recruitWindowMonths: sc.recruitWindowMonths,
    reservePct: sc.reservePct,
    recruitmentsBySource,
    changes: typeof kpis?.kpis?.changes === "number" ? kpis.kpis.changes : null,
  };
}
