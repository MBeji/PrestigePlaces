import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { seatsFromPositions, type DirectionParam } from "@/lib/engine";
import { DIRECTIONS } from "@/lib/directions";
import { simulate, simulationInputSchema, type SimulationInput, type SimulationResult } from "@/lib/simulation";
import { actorOf, audit } from "./context";
import { cloneScenario, getScenario, type ScenarioSummary } from "./scenarios";
import { notFound, parseInput, ServiceError } from "./errors";

const EQUATION = DIRECTIONS.filter((d) => d.inEquation).map((d) => d.code);

export const saveSimulationSchema = z.object({ name: z.string().trim().min(1, "nom requis").max(120), hypotheses: simulationInputSchema });

async function loadSimulation(scenarioId: string, raw: unknown): Promise<SimulationResult> {
  const input = parseInput(simulationInputSchema, raw);
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw notFound("Scénario");
  const [positions, assignments, params, zones] = await Promise.all([
    prisma.position.findMany({ select: { id: true, r: true, c: true, kind: true, groupCode: true, zoneToFree: true, reserved: true, floor: { select: { code: true } } } }),
    prisma.assignment.findMany({ where: { scenarioId }, select: { positionId: true, directionCode: true } }),
    prisma.scenarioDirectionParam.findMany({ where: { scenarioId } }),
    prisma.scenarioZone.findMany({ where: { scenarioId }, select: { positionId: true } }),
  ]);
  if (positions.length === 0) throw new ServiceError(422, "REGLE_METIER", "Aucune position en base : lancer le seed.");
  const directions: DirectionParam[] = EQUATION.map((code) => {
    const p = params.find((x) => x.directionCode === code);
    return { code, cdi: p?.cdi ?? 0, externes: p?.externes ?? 0, recrutements: p?.recrutements ?? 0, fixedSeats: p?.fixedSeats ?? 0 };
  });
  return simulate(seatsFromPositions(positions, assignments), { directions, reservePct: sc.reservePct }, input, zones.map((z) => z.positionId));
}

/**
 * Simule un scénario à partir d'hypothèses modifiées (effectifs, réserve, niveaux libérés) sur les positions et
 * affectations réelles du scénario `scenarioId`. Rien n'est écrit en base. Droit : lire.
 */
export async function simulateScenario(scenarioId: string, input: SimulationInput | unknown): Promise<SimulationResult> {
  await requirePermission("lire");
  return loadSimulation(scenarioId, input);
}

/**
 * Enregistre une simulation comme nouveau scénario (brouillon) : copie du scénario de départ, puis effectifs,
 * réserve et zones à libérer de la simulation. Droit : scenario.gerer.
 */
export async function saveSimulation(scenarioId: string, input: z.input<typeof saveSimulationSchema>): Promise<ScenarioSummary> {
  const session = await requirePermission("scenario.gerer");
  const d = parseInput(saveSimulationSchema, input);
  const sim = await loadSimulation(scenarioId, d.hypotheses);
  const id = await prisma.$transaction(
    async (tx) => {
      const notes = [`Scénario IA : ${sim.titre}`, ...sim.hypotheses].join("\n").slice(0, 2000);
      const nid = await cloneScenario(tx, scenarioId, { name: d.name, notes, reservePct: sim.reservePct, withAssignments: true });
      for (const row of sim.rows) {
        await tx.scenarioDirectionParam.upsert({
          where: { scenarioId_directionCode: { scenarioId: nid, directionCode: row.code } },
          update: { cdi: row.cdi, externes: row.externes, recrutements: row.recrutements },
          create: { scenarioId: nid, directionCode: row.code, cdi: row.cdi, externes: row.externes, recrutements: row.recrutements, fixedSeats: row.fixedSeats },
        });
      }
      if (sim.extraZoneIds.length)
        await tx.scenarioZone.createMany({ data: sim.extraZoneIds.map((positionId) => ({ scenarioId: nid, positionId })) });
      await audit(tx, actorOf(session), "SCENARIO_IA_ENREGISTRE", "Scenario", nid, { source: scenarioId, titre: sim.titre, hypotheses: sim.hypotheses });
      return nid;
    },
    { timeout: 60_000, maxWait: 30_000 },
  );
  return getScenario(id);
}
