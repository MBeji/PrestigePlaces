import { z } from "zod";
import type { ScenarioStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import type { Action } from "@/lib/auth/permissions";
import { actorOf, audit, type Tx } from "./context";
import { notFound, parseInput, ServiceError } from "./errors";

export const SCENARIO_STATUSES = ["DRAFT", "PROPOSED", "VALIDATED", "PUBLISHED"] as const;

/** Transitions autorisées du statut d'un scénario. */
export const STATUS_TRANSITIONS: Record<ScenarioStatus, readonly ScenarioStatus[]> = {
  DRAFT: ["PROPOSED"],
  PROPOSED: ["DRAFT", "VALIDATED"],
  VALIDATED: ["PROPOSED", "PUBLISHED"],
  PUBLISHED: ["VALIDATED"],
};

const STATUS_ACTION: Record<ScenarioStatus, Action> = {
  DRAFT: "scenario.gerer",
  PROPOSED: "scenario.gerer",
  VALIDATED: "scenario.valider",
  PUBLISHED: "scenario.publier",
};

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1, "nom requis").max(120),
  notes: z.string().max(2000).nullish(),
  /** Scénario source dont on copie paramètres, recrutements, externes, zones et affectations (défaut : scénario actif). */
  fromScenarioId: z.string().min(1).optional(),
  reservePct: z.number().min(0).max(50).optional(),
  recruitWindowMonths: z.number().int().min(1).max(24).optional(),
});
export const duplicateScenarioSchema = z.object({ name: z.string().trim().min(1).max(120).optional() });
export const statusSchema = z.object({ status: z.enum(SCENARIO_STATUSES) });

export interface ScenarioSummary {
  id: string;
  name: string;
  createdAt: Date;
  status: ScenarioStatus;
  isActive: boolean;
  reservePct: number;
  recruitWindowMonths: number;
  notes: string | null;
  parentId: string | null;
  assignments: number;
  movements: number;
}

const toSummary = (s: {
  id: string; name: string; createdAt: Date; status: ScenarioStatus; isActive: boolean; reservePct: number;
  recruitWindowMonths: number; notes: string | null; parentId: string | null; _count: { assignments: number; movements: number };
}): ScenarioSummary => ({
  id: s.id, name: s.name, createdAt: s.createdAt, status: s.status, isActive: s.isActive, reservePct: s.reservePct,
  recruitWindowMonths: s.recruitWindowMonths, notes: s.notes, parentId: s.parentId,
  assignments: s._count.assignments, movements: s._count.movements,
});
const COUNT = { _count: { select: { assignments: true, movements: true } } } as const;

/** Liste des scénarios (plus récents d'abord ; les propositions dérivées ont `parentId`). */
export async function listScenarios(): Promise<ScenarioSummary[]> {
  await requirePermission("lire");
  const rows = await prisma.scenario.findMany({ orderBy: { createdAt: "desc" }, include: COUNT });
  return rows.map(toSummary);
}

export async function getScenario(id: string): Promise<ScenarioSummary> {
  await requirePermission("lire");
  const s = await prisma.scenario.findUnique({ where: { id }, include: COUNT });
  if (!s) throw notFound("Scénario");
  return toSummary(s);
}

/**
 * Copie un scénario : paramètres, recrutements, consultants externes, zones. Les affectations sont copiées si
 * `withAssignments`. Utilisé par la création, la duplication et par proposal.run (scénario dérivé).
 */
export async function cloneScenario(
  tx: Tx,
  sourceId: string,
  data: { name: string; parentId?: string | null; notes?: string | null; reservePct?: number; recruitWindowMonths?: number; withAssignments: boolean },
): Promise<string> {
  const src = await tx.scenario.findUnique({
    where: { id: sourceId },
    include: { params: true, recruitments: true, externals: true, zones: true },
  });
  if (!src) throw notFound("Scénario source");
  const created = await tx.scenario.create({
    data: {
      name: data.name,
      notes: data.notes === undefined ? src.notes : data.notes,
      parentId: data.parentId ?? null,
      reservePct: data.reservePct ?? src.reservePct,
      recruitWindowMonths: data.recruitWindowMonths ?? src.recruitWindowMonths,
    },
  });
  const sid = created.id;
  if (src.params.length)
    await tx.scenarioDirectionParam.createMany({
      data: src.params.map((p) => ({ scenarioId: sid, directionCode: p.directionCode, cdi: p.cdi, externes: p.externes, recrutements: p.recrutements, fixedSeats: p.fixedSeats })),
    });
  if (src.recruitments.length)
    await tx.recruitment.createMany({
      data: src.recruitments.map((r) => ({ scenarioId: sid, directionCode: r.directionCode, poleCode: r.poleCode, count: r.count, source: r.source, expectedDate: r.expectedDate, reference: r.reference })),
    });
  if (src.externals.length)
    await tx.externalConsultant.createMany({
      data: src.externals.map((e) => ({ scenarioId: sid, directionCode: e.directionCode, poleCode: e.poleCode, count: e.count, endDate: e.endDate })),
    });
  if (src.zones.length) await tx.scenarioZone.createMany({ data: src.zones.map((z) => ({ scenarioId: sid, positionId: z.positionId })) });
  if (data.withAssignments) {
    const rows = await tx.assignment.findMany({ where: { scenarioId: sourceId }, select: { positionId: true, directionCode: true, personRef: true } });
    for (let i = 0; i < rows.length; i += 1000)
      await tx.assignment.createMany({ data: rows.slice(i, i + 1000).map((a) => ({ scenarioId: sid, positionId: a.positionId, directionCode: a.directionCode, personRef: a.personRef })) });
  }
  return sid;
}

/** Crée un scénario (copie du scénario `fromScenarioId` ou, à défaut, du scénario actif). Droit : scenario.gerer. */
export async function createScenario(input: z.input<typeof createScenarioSchema>): Promise<ScenarioSummary> {
  const session = await requirePermission("scenario.gerer");
  const d = parseInput(createScenarioSchema, input);
  const id = await prisma.$transaction(async (tx) => {
    const base = d.fromScenarioId ? await tx.scenario.findUnique({ where: { id: d.fromScenarioId } }) : await tx.scenario.findFirst({ where: { isActive: true } });
    if (d.fromScenarioId && !base) throw notFound("Scénario source");
    let newId: string;
    if (base) {
      newId = await cloneScenario(tx, base.id, { name: d.name, notes: d.notes ?? null, reservePct: d.reservePct, recruitWindowMonths: d.recruitWindowMonths, withAssignments: true });
    } else {
      newId = (await tx.scenario.create({ data: { name: d.name, notes: d.notes ?? null, reservePct: d.reservePct ?? 0, recruitWindowMonths: d.recruitWindowMonths ?? 3 } })).id;
    }
    await audit(tx, actorOf(session), "SCENARIO_CREE", "Scenario", newId, { name: d.name, source: base?.id ?? null });
    return newId;
  });
  return getScenario(id);
}

/** Duplique un scénario (avec ses affectations). Droit : scenario.gerer. */
export async function duplicateScenario(id: string, input: z.input<typeof duplicateScenarioSchema> = {}): Promise<ScenarioSummary> {
  const session = await requirePermission("scenario.gerer");
  const d = parseInput(duplicateScenarioSchema, input);
  const newId = await prisma.$transaction(async (tx) => {
    const src = await tx.scenario.findUnique({ where: { id } });
    if (!src) throw notFound("Scénario");
    const nid = await cloneScenario(tx, id, { name: d.name ?? `Copie de ${src.name}`, parentId: null, withAssignments: true });
    await audit(tx, actorOf(session), "SCENARIO_DUPLIQUE", "Scenario", nid, { source: id });
    return nid;
  });
  return getScenario(newId);
}

/** Change le statut selon STATUS_TRANSITIONS. Droit selon la cible : valider, publier ou gérer. Journalisé. */
export async function setScenarioStatus(id: string, input: z.input<typeof statusSchema>): Promise<ScenarioSummary> {
  const { status } = parseInput(statusSchema, input);
  const session = await requirePermission(STATUS_ACTION[status]);
  await prisma.$transaction(async (tx) => {
    const s = await tx.scenario.findUnique({ where: { id } });
    if (!s) throw notFound("Scénario");
    if (!STATUS_TRANSITIONS[s.status].includes(status))
      throw new ServiceError(409, "CONFLIT", `Passage de ${s.status} à ${status} impossible.`);
    if (status === "VALIDATED" || status === "PUBLISHED") {
      const moves = await tx.assignment.count({ where: { scenarioId: id } });
      if (moves === 0) throw new ServiceError(422, "REGLE_METIER", "Ce scénario n'a aucune affectation à valider.");
    }
    await tx.scenario.update({ where: { id }, data: { status } });
    await audit(tx, actorOf(session), "SCENARIO_STATUT", "Scenario", id, { de: s.status, vers: status });
  });
  return getScenario(id);
}

/** Désigne le scénario actif (un seul). Droit : scenario.gerer. */
export async function setActiveScenario(id: string): Promise<ScenarioSummary> {
  const session = await requirePermission("scenario.gerer");
  await prisma.$transaction(async (tx) => {
    const s = await tx.scenario.findUnique({ where: { id } });
    if (!s) throw notFound("Scénario");
    await tx.scenario.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.scenario.update({ where: { id }, data: { isActive: true } });
    await audit(tx, actorOf(session), "SCENARIO_ACTIF", "Scenario", id);
  });
  return getScenario(id);
}
