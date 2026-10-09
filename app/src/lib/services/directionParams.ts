import { z } from "zod";
import type { RecruitmentSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { DIRECTIONS } from "@/lib/directions";
import { actorOf, audit, LOCKED_STATUSES, type Tx } from "./context";
import { notFound, parseInput, ServiceError } from "./errors";

const EQUATION = DIRECTIONS.filter((d) => d.inEquation);
const count = z.number().int().min(0).max(100000);

export const directionParamsSchema = z
  .object({ cdi: count.optional(), externes: count.optional(), recrutements: count.optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "au moins une valeur à modifier");
export const recruitmentSchema = z.object({
  directionCode: z.string().min(1),
  poleCode: z.string().min(1).nullish(),
  count: z.number().int().min(1).max(10000),
  source: z.enum(["SIRH", "MAIL_CLIENT"]),
  /** Date d'arrivée prévue (SIRH) ou date de la déclaration du client (mail). */
  expectedDate: z.coerce.date(),
  reference: z.string().max(200).nullish(),
});
export const externalSchema = z.object({
  directionCode: z.string().min(1),
  poleCode: z.string().min(1).nullish(),
  count: z.number().int().min(1).max(10000),
  endDate: z.coerce.date().nullish(),
});

export interface RecruitmentItem {
  id: string; poleCode: string | null; count: number; source: RecruitmentSource; expectedDate: Date; reference: string | null;
  /** Compté dans l'effectif cible : SIRH, ou mail client dont la date tombe dans la fenêtre du scénario. */
  counted: boolean;
}
export interface ExternalItem { id: string; poleCode: string | null; count: number; endDate: Date | null; counted: boolean }
export interface DirectionParamsView {
  directionCode: string;
  label: string;
  cdi: number;
  externes: number;
  recrutements: number;
  fixedSeats: number;
  /** cdi + externes + recrutements */
  targetHeadcount: number;
  recruitments: RecruitmentItem[];
  externals: ExternalItem[];
}

const windowEnd = (months: number, now = new Date()) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() + months);
  return d;
};
/** Règle des recrutements comptés : ouverts dans le SIRH, ou déclarés par mail sur la fenêtre (en mois). */
export function isRecruitmentCounted(r: { source: RecruitmentSource; expectedDate: Date }, windowMonths: number, now = new Date()) {
  return r.source === "SIRH" || r.expectedDate <= windowEnd(windowMonths, now);
}

/** Règle des externes comptés : missions en cours à la date du calcul (sans date de fin, ou fin non dépassée). */
export function isExternalCounted(e: { endDate: Date | null }, now = new Date()) {
  if (!e.endDate) return true;
  const end = new Date(e.endDate);
  end.setUTCHours(23, 59, 59, 999);
  return end >= now;
}

/** Paramètres des 5 directions d'un scénario, avec les listes de recrutements et de consultants. Droit : lire. */
export async function getDirectionParams(scenarioId: string): Promise<DirectionParamsView[]> {
  await requirePermission("lire");
  const sc = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { params: true, recruitments: { orderBy: { expectedDate: "asc" } }, externals: true },
  });
  if (!sc) throw notFound("Scénario");
  return EQUATION.map((d) => {
    const p = sc.params.find((x) => x.directionCode === d.code);
    const cdi = p?.cdi ?? 0, externes = p?.externes ?? 0, recrutements = p?.recrutements ?? 0;
    return {
      directionCode: d.code, label: d.label, cdi, externes, recrutements, fixedSeats: p?.fixedSeats ?? 0,
      targetHeadcount: cdi + externes + recrutements,
      recruitments: sc.recruitments.filter((r) => r.directionCode === d.code).map((r) => ({
        id: r.id, poleCode: r.poleCode, count: r.count, source: r.source, expectedDate: r.expectedDate, reference: r.reference,
        counted: isRecruitmentCounted(r, sc.recruitWindowMonths),
      })),
      externals: sc.externals.filter((e) => e.directionCode === d.code).map((e) => ({ id: e.id, poleCode: e.poleCode, count: e.count, endDate: e.endDate, counted: isExternalCounted(e) })),
    };
  });
}

async function assertEditable(tx: Tx, scenarioId: string, directionCode: string) {
  if (!EQUATION.some((d) => d.code === directionCode)) throw new ServiceError(400, "VALIDATION", `Direction « ${directionCode} » hors équation.`);
  const sc = await tx.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw notFound("Scénario");
  if ((LOCKED_STATUSES as readonly string[]).includes(sc.status)) throw new ServiceError(409, "CONFLIT", "Scénario validé ou publié : paramètres verrouillés.");
  return sc;
}

async function upsertParam(tx: Tx, scenarioId: string, directionCode: string, data: { cdi?: number; externes?: number; recrutements?: number }) {
  await tx.scenarioDirectionParam.upsert({
    where: { scenarioId_directionCode: { scenarioId, directionCode } },
    update: data,
    create: { scenarioId, directionCode, ...data },
  });
}

/** Recalcule `recrutements` / `externes` du paramètre à partir des lignes saisies. */
async function syncFromLists(tx: Tx, scenarioId: string, directionCode: string, windowMonths: number) {
  const [recs, exts] = await Promise.all([
    tx.recruitment.findMany({ where: { scenarioId, directionCode } }),
    tx.externalConsultant.findMany({ where: { scenarioId, directionCode } }),
  ]);
  await upsertParam(tx, scenarioId, directionCode, {
    recrutements: recs.filter((r) => isRecruitmentCounted(r, windowMonths)).reduce((s, r) => s + r.count, 0),
    externes: exts.filter((e) => isExternalCounted(e)).reduce((s, e) => s + e.count, 0),
  });
}

/**
 * Modifie CDI, externes et/ou recrutements d'une direction. Droit : parametres.modifier sur cette direction
 * (services généraux, ou directeur de la direction). Refusé (409) si le scénario est validé ou publié.
 */
export async function updateDirectionParams(scenarioId: string, directionCode: string, input: z.input<typeof directionParamsSchema>) {
  const session = await requirePermission("parametres.modifier", { directionCode });
  const d = parseInput(directionParamsSchema, input);
  await prisma.$transaction(async (tx) => {
    await assertEditable(tx, scenarioId, directionCode);
    const before = await tx.scenarioDirectionParam.findUnique({ where: { scenarioId_directionCode: { scenarioId, directionCode } } });
    const data = Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) as { cdi?: number; externes?: number; recrutements?: number };
    await upsertParam(tx, scenarioId, directionCode, data);
    await audit(tx, actorOf(session), "PARAMETRES_DIRECTION", "ScenarioDirectionParam", scenarioId, {
      direction: directionCode, avant: before && { cdi: before.cdi, externes: before.externes, recrutements: before.recrutements }, apres: data,
    });
  });
  return (await getDirectionParams(scenarioId)).find((x) => x.directionCode === directionCode)!;
}

/** Ajoute un recrutement (source SIRH ou MAIL_CLIENT + date) et resynchronise `recrutements`. Droit : parametres.modifier. */
export async function addRecruitment(scenarioId: string, input: z.input<typeof recruitmentSchema>) {
  const d = parseInput(recruitmentSchema, input);
  const session = await requirePermission("parametres.modifier", { directionCode: d.directionCode });
  const id = await prisma.$transaction(async (tx) => {
    const sc = await assertEditable(tx, scenarioId, d.directionCode);
    const r = await tx.recruitment.create({ data: { scenarioId, directionCode: d.directionCode, poleCode: d.poleCode ?? null, count: d.count, source: d.source, expectedDate: d.expectedDate, reference: d.reference ?? null } });
    await syncFromLists(tx, scenarioId, d.directionCode, sc.recruitWindowMonths);
    await audit(tx, actorOf(session), "RECRUTEMENT_AJOUTE", "Recruitment", r.id, { scenarioId, ...d });
    return r.id;
  });
  return { id, direction: (await getDirectionParams(scenarioId)).find((x) => x.directionCode === d.directionCode)! };
}

export async function removeRecruitment(scenarioId: string, recruitmentId: string) {
  const r0 = await prisma.recruitment.findFirst({ where: { id: recruitmentId, scenarioId } });
  if (!r0) throw notFound("Recrutement");
  const session = await requirePermission("parametres.modifier", { directionCode: r0.directionCode });
  await prisma.$transaction(async (tx) => {
    const sc = await assertEditable(tx, scenarioId, r0.directionCode);
    await tx.recruitment.delete({ where: { id: recruitmentId } });
    await syncFromLists(tx, scenarioId, r0.directionCode, sc.recruitWindowMonths);
    await audit(tx, actorOf(session), "RECRUTEMENT_SUPPRIME", "Recruitment", recruitmentId, { scenarioId, direction: r0.directionCode, count: r0.count });
  });
  return (await getDirectionParams(scenarioId)).find((x) => x.directionCode === r0.directionCode)!;
}

/** Ajoute des consultants externes et resynchronise `externes`. Droit : parametres.modifier. */
export async function addExternal(scenarioId: string, input: z.input<typeof externalSchema>) {
  const d = parseInput(externalSchema, input);
  const session = await requirePermission("parametres.modifier", { directionCode: d.directionCode });
  const id = await prisma.$transaction(async (tx) => {
    const sc = await assertEditable(tx, scenarioId, d.directionCode);
    const e = await tx.externalConsultant.create({ data: { scenarioId, directionCode: d.directionCode, poleCode: d.poleCode ?? null, count: d.count, endDate: d.endDate ?? null } });
    await syncFromLists(tx, scenarioId, d.directionCode, sc.recruitWindowMonths);
    await audit(tx, actorOf(session), "EXTERNE_AJOUTE", "ExternalConsultant", e.id, { scenarioId, ...d });
    return e.id;
  });
  return { id, direction: (await getDirectionParams(scenarioId)).find((x) => x.directionCode === d.directionCode)! };
}

export async function removeExternal(scenarioId: string, externalId: string) {
  const e0 = await prisma.externalConsultant.findFirst({ where: { id: externalId, scenarioId } });
  if (!e0) throw notFound("Consultant externe");
  const session = await requirePermission("parametres.modifier", { directionCode: e0.directionCode });
  await prisma.$transaction(async (tx) => {
    const sc = await assertEditable(tx, scenarioId, e0.directionCode);
    await tx.externalConsultant.delete({ where: { id: externalId } });
    await syncFromLists(tx, scenarioId, e0.directionCode, sc.recruitWindowMonths);
    await audit(tx, actorOf(session), "EXTERNE_SUPPRIME", "ExternalConsultant", externalId, { scenarioId, direction: e0.directionCode, count: e0.count });
  });
  return (await getDirectionParams(scenarioId)).find((x) => x.directionCode === e0.directionCode)!;
}
