import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { actorOf, audit, LOCKED_STATUSES } from "./context";
import { notFound, parseInput, ServiceError } from "./errors";

export const scenarioParamsSchema = z
  .object({
    reservePct: z.number().min(0).max(50).optional(),
    recruitWindowMonths: z.number().int().min(1).max(24).optional(),
    notes: z.string().max(2000).nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "au moins une valeur à modifier");
export const zonesSchema = z.object({ positionIds: z.array(z.string().min(1)).max(5000) });

export interface ScenarioParamsView {
  scenarioId: string;
  reservePct: number;
  recruitWindowMonths: number;
  notes: string | null;
  /** Positions de zone à libérer définies sur le plan (Position.zoneToFree) : toujours exclues. */
  baseZoneCount: number;
  /** Zones à libérer supplémentaires propres au scénario. */
  extraZones: { positionId: string; floor: string; r: number; c: number }[];
}

export async function getScenarioParams(scenarioId: string): Promise<ScenarioParamsView> {
  await requirePermission("lire");
  const sc = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { zones: { include: { position: { include: { floor: { select: { code: true } } } } } } },
  });
  if (!sc) throw notFound("Scénario");
  return {
    scenarioId, reservePct: sc.reservePct, recruitWindowMonths: sc.recruitWindowMonths, notes: sc.notes,
    baseZoneCount: await prisma.position.count({ where: { zoneToFree: true } }),
    extraZones: sc.zones.map((z) => ({ positionId: z.positionId, floor: z.position.floor.code, r: z.position.r, c: z.position.c })),
  };
}

async function assertEditable(scenarioId: string) {
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw notFound("Scénario");
  if ((LOCKED_STATUSES as readonly string[]).includes(sc.status)) throw new ServiceError(409, "CONFLIT", "Scénario validé ou publié : paramètres verrouillés.");
  return sc;
}

/** Modifie réserve (%), fenêtre de recrutement (mois) et notes. Droit : scenario.gerer. */
export async function updateScenarioParams(scenarioId: string, input: z.input<typeof scenarioParamsSchema>) {
  const session = await requirePermission("scenario.gerer");
  const d = parseInput(scenarioParamsSchema, input);
  const before = await assertEditable(scenarioId);
  await prisma.$transaction(async (tx) => {
    await tx.scenario.update({ where: { id: scenarioId }, data: { reservePct: d.reservePct, recruitWindowMonths: d.recruitWindowMonths, notes: d.notes } });
    await audit(tx, actorOf(session), "PARAMETRES_SCENARIO", "Scenario", scenarioId, {
      avant: { reservePct: before.reservePct, recruitWindowMonths: before.recruitWindowMonths }, apres: d,
    });
  });
  return getScenarioParams(scenarioId);
}

/** Remplace la liste des zones à libérer supplémentaires du scénario. Droit : scenario.gerer. */
export async function setScenarioZones(scenarioId: string, input: z.input<typeof zonesSchema>) {
  const session = await requirePermission("scenario.gerer");
  const { positionIds } = parseInput(zonesSchema, input);
  await assertEditable(scenarioId);
  const ids = [...new Set(positionIds)];
  const found = await prisma.position.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ServiceError(400, "VALIDATION", "Une ou plusieurs positions sont inconnues.");
  // Règles métier : les positions support et les postes fixes (directeur, manager) ne bougent jamais.
  const forbidden = await prisma.position.count({ where: { id: { in: ids }, OR: [{ groupCode: "SUP" }, { kind: { in: ["d", "m"] } }] } });
  if (forbidden > 0) {
    throw new ServiceError(400, "VALIDATION", "Une zone à libérer ne peut contenir ni position support ni poste fixe (directeur, manager).");
  }
  await prisma.$transaction(async (tx) => {
    await tx.scenarioZone.deleteMany({ where: { scenarioId } });
    if (ids.length) await tx.scenarioZone.createMany({ data: ids.map((positionId) => ({ scenarioId, positionId })) });
    await audit(tx, actorOf(session), "ZONES_A_LIBERER", "Scenario", scenarioId, { positions: ids.length });
  });
  return getScenarioParams(scenarioId);
}
