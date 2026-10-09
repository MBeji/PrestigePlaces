import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { proposeAllocation, seatsFromPositions, VIDE, type DirectionParam, type ProposalKpis } from "@/lib/engine";
import { DIRECTIONS } from "@/lib/directions";
import { actorOf, audit } from "./context";
import { cloneScenario } from "./scenarios";
import { notFound, ServiceError } from "./errors";

/**
 * Stockage de la proposition : un scénario DÉRIVÉ « Proposition de <nom> » (Scenario.parentId = scénario source).
 * Il copie les paramètres du source, ses Assignment sont les affectations proposées (les positions VIDE n'ont pas de
 * ligne), ses Movement listent les changements (to = "VIDE" pour une libération), et Scenario.kpis contient le
 * détail du calcul (type StoredProposalKpis). Relancer le calcul remplace le contenu du même scénario dérivé.
 * Le scénario source n'est jamais modifié.
 */
export interface StoredProposalKpis {
  computedAt: string;
  sourceScenarioId: string;
  quota: Record<string, number>;
  current: Record<string, number>;
  delta: Record<string, number>;
  targetHeadcount: Record<string, number>;
  floorPlan: { release: Record<string, number>; gain: Record<string, number>; toReserve: Record<string, number>; feasible: boolean };
  kpis: ProposalKpis;
  /** Numéro d'îlot du moteur (1..n par niveau) des positions en mouvement. */
  islandByPosition: Record<string, number>;
}

export interface ProposalMovementView {
  positionId: string; floor: string; r: number; c: number; kind: string; island: number | null; from: string; to: string;
}
export interface ProposalView extends StoredProposalKpis {
  /** Scénario dérivé qui porte la proposition. */
  scenarioId: string;
  name: string;
  status: string;
  movements: ProposalMovementView[];
}

const PARAM_ORDER = DIRECTIONS.filter((d) => d.inEquation).map((d) => d.code);

/** Lance le calcul. Droit : proposition.calculer. Source = le scénario, ou son parent si on passe une proposition. */
export async function runProposal(scenarioId: string): Promise<ProposalView> {
  const session = await requirePermission("proposition.calculer");
  const given = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!given) throw notFound("Scénario");
  const source = given.parentId ? await prisma.scenario.findUnique({ where: { id: given.parentId } }) : given;
  if (!source) throw notFound("Scénario source");

  const [positions, assignments, params, zones] = await Promise.all([
    prisma.position.findMany({ select: { id: true, r: true, c: true, kind: true, groupCode: true, zoneToFree: true, reserved: true, floor: { select: { code: true } } } }),
    prisma.assignment.findMany({ where: { scenarioId: source.id }, select: { positionId: true, directionCode: true } }),
    prisma.scenarioDirectionParam.findMany({ where: { scenarioId: source.id } }),
    prisma.scenarioZone.findMany({ where: { scenarioId: source.id }, select: { positionId: true } }),
  ]);
  if (positions.length === 0) throw new ServiceError(422, "REGLE_METIER", "Aucune position en base : lancer le seed.");
  if (params.length === 0) throw new ServiceError(422, "REGLE_METIER", "Le scénario n'a aucun paramètre de direction.");
  const dirParams: DirectionParam[] = PARAM_ORDER.map((code) => {
    const p = params.find((x) => x.directionCode === code);
    return { code, cdi: p?.cdi ?? 0, externes: p?.externes ?? 0, recrutements: p?.recrutements ?? 0, fixedSeats: p?.fixedSeats ?? 0 };
  });

  const seats = seatsFromPositions(positions, assignments);
  const result = proposeAllocation(seats, dirParams, { reservePct: source.reservePct, extraZoneToFree: zones.map((z) => z.positionId) });
  const zoneSet = new Set([...zones.map((z) => z.positionId), ...positions.filter((p) => p.zoneToFree).map((p) => p.id)]);

  const stored: StoredProposalKpis = {
    computedAt: new Date().toISOString(),
    sourceScenarioId: source.id,
    quota: result.quota, current: result.current, delta: result.delta, targetHeadcount: result.targetHeadcount,
    floorPlan: result.floorPlan, kpis: result.kpis,
    islandByPosition: Object.fromEntries(result.movements.map((m) => [m.seatId, m.island])),
  };

  const derivedId = await prisma.$transaction(
    async (tx) => {
      const name = `Proposition de ${source.name}`;
      const existing = await tx.scenario.findFirst({ where: { parentId: source.id } });
      let id: string;
      if (existing) {
        id = existing.id;
        await tx.assignment.deleteMany({ where: { scenarioId: id } });
        await tx.movement.deleteMany({ where: { scenarioId: id } });
        await tx.scenario.update({ where: { id }, data: { name, status: "PROPOSED", reservePct: source.reservePct, recruitWindowMonths: source.recruitWindowMonths } });
      } else {
        id = await cloneScenario(tx, source.id, { name, parentId: source.id, withAssignments: false });
        await tx.scenario.update({ where: { id }, data: { status: "PROPOSED" } });
      }
      const rows: { scenarioId: string; positionId: string; directionCode: string }[] = [];
      for (const [positionId, directionCode] of result.proposed) {
        if (directionCode === VIDE || zoneSet.has(positionId)) continue;
        rows.push({ scenarioId: id, positionId, directionCode });
      }
      for (let i = 0; i < rows.length; i += 1000) await tx.assignment.createMany({ data: rows.slice(i, i + 1000) });
      if (result.movements.length)
        await tx.movement.createMany({ data: result.movements.map((m) => ({ scenarioId: id, positionId: m.seatId, fromDirection: m.from, toDirection: m.to })) });
      await tx.scenario.update({ where: { id }, data: { kpis: stored as unknown as Prisma.InputJsonValue } });
      await audit(tx, actorOf(session), "PROPOSITION_CALCULEE", "Scenario", id, {
        source: source.id, changements: result.kpis.changes, mouvements: result.movements.length, quotas: result.quota,
      });
      return id;
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  return getProposal(derivedId);
}

/**
 * Proposition d'un scénario : passer l'id du scénario source ou celui du scénario dérivé.
 * Lève 404 si aucune proposition n'a été calculée. Droit : lire.
 */
export async function getProposal(scenarioId: string): Promise<ProposalView> {
  await requirePermission("lire");
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw notFound("Scénario");
  const derived = sc.parentId ? sc : await prisma.scenario.findFirst({ where: { parentId: sc.id } });
  if (!derived || !derived.kpis) throw notFound("Proposition");
  const stored = derived.kpis as unknown as StoredProposalKpis;
  const moves = await prisma.movement.findMany({
    where: { scenarioId: derived.id },
    include: { position: { select: { r: true, c: true, kind: true, floor: { select: { code: true, ord: true } } } } },
  });
  const movements: ProposalMovementView[] = moves
    .map((m) => ({
      positionId: m.positionId, floor: m.position.floor.code, r: m.position.r, c: m.position.c, kind: m.position.kind,
      island: stored.islandByPosition?.[m.positionId] ?? null, from: m.fromDirection, to: m.toDirection, ord: m.position.floor.ord,
    }))
    .sort((a, b) => a.ord - b.ord || (a.island ?? 0) - (b.island ?? 0) || a.r - b.r || a.c - b.c)
    .map((m) => ({ positionId: m.positionId, floor: m.floor, r: m.r, c: m.c, kind: m.kind, island: m.island, from: m.from, to: m.to }));
  return { ...stored, scenarioId: derived.id, name: derived.name, status: derived.status, movements };
}
