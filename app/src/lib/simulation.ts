/**
 * Simulation d'un scénario (module pur, sans Prisma ni React) : applique des hypothèses modifiées
 * (effectifs, réserve, niveaux à libérer) aux positions réelles d'un scénario et lance le moteur, sans rien écrire.
 * Utilisé par les scénarios IA : l'assistant décrit les hypothèses, l'application calcule les chiffres.
 */
import { z } from "zod";
import { computeQuotas, proposeAllocation, VIDE, type DirectionParam, type Seat } from "@/lib/engine";

export const SIM_DIRECTIONS = ["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI"] as const;
export const SIM_FLOORS = ["RDC", "1", "2", "3", "4"] as const;

const count = z.number().int().min(0).max(100000);

/** Hypothèses d'une simulation : valeurs absolues, seules les valeurs données remplacent celles du scénario. */
export const simulationInputSchema = z.object({
  titre: z.string().trim().min(1).max(120),
  reservePct: z.number().min(0).max(50).optional(),
  directions: z
    .array(z.object({ code: z.enum(SIM_DIRECTIONS), cdi: count.optional(), externes: count.optional(), recrutements: count.optional() }))
    .max(SIM_DIRECTIONS.length)
    .optional(),
  niveauxALiberer: z.array(z.enum(SIM_FLOORS)).max(SIM_FLOORS.length).optional(),
});
export type SimulationInput = z.infer<typeof simulationInputSchema>;

export interface SimulationBase {
  directions: DirectionParam[];
  reservePct: number;
}

export interface SimulationDirectionRow {
  code: string;
  cdi: number;
  externes: number;
  recrutements: number;
  fixedSeats: number;
  /** Effectif cible du scénario de départ et de la simulation. */
  targetBefore: number;
  targetAfter: number;
  /** Positions occupées aujourd'hui (pool du scénario de départ). */
  current: number;
  /** Quota du scénario de départ et quota simulé. */
  quotaBefore: number;
  quotaAfter: number;
}

export interface SimulationResult {
  titre: string;
  reservePct: number;
  reservePctBefore: number;
  niveauxALiberer: string[];
  /** Lignes par direction (ordre de l'équation). */
  rows: SimulationDirectionRow[];
  kpis: {
    positionsToAllocate: number;
    positionsToAllocateBefore: number;
    reserve: number;
    targetHeadcount: number;
    targetHeadcountBefore: number;
    rate: number;
    rateBefore: number;
    /** Positions reprises par une autre direction. */
    changes: number;
    /** Positions libérées (vers vide : réserve ou niveaux libérés). */
    released: number;
    feasible: boolean;
  };
  /** Positions par niveau et par direction, avant et après (pool et niveaux libérés, hors support et zone de formation). */
  floorsBefore: Record<string, Record<string, number>>;
  floorsAfter: Record<string, Record<string, number>>;
  /** Positions libérées par les niveaux à libérer (hors postes fixes et support). */
  freedPositions: number;
  /** Direction simulée des positions qui changent (id -> direction, VIDE comprise). */
  changed: Record<string, string>;
  /** Positions des niveaux libérés, traitées comme zones à libérer. */
  extraZoneIds: string[];
  /** Phrases décrivant les hypothèses modifiées par rapport au scénario de départ. */
  hypotheses: string[];
}

const LABEL: Record<string, string> = { cdi: "CDI", externes: "externes", recrutements: "recrutements" };

/** Paramètres de directions après application des hypothèses. */
export function applyOverrides(base: readonly DirectionParam[], input: Pick<SimulationInput, "directions">): DirectionParam[] {
  return base.map((d) => {
    const o = input.directions?.find((x) => x.code === d.code);
    return { ...d, cdi: o?.cdi ?? d.cdi, externes: o?.externes ?? d.externes, recrutements: o?.recrutements ?? d.recrutements };
  });
}

/** Positions des niveaux libérés : hors support, hors postes fixes occupés et postes réservés (ils ne bougent jamais). */
export function freedSeatIds(seats: readonly Seat[], floors: readonly string[]): string[] {
  const set = new Set(floors);
  return seats.filter((s) => set.has(s.floor) && !s.zoneToFree && !(s.fixed && s.direction !== VIDE) && !s.reserved && s.groupCode !== "SUP" && s.direction !== "SUPPORT").map((s) => s.id);
}

/** Décrit les hypothèses modifiées, en français. */
export function describeHypotheses(base: SimulationBase, input: SimulationInput): string[] {
  const out: string[] = [];
  for (const o of input.directions ?? []) {
    const b = base.directions.find((d) => d.code === o.code);
    if (!b) continue;
    for (const k of ["cdi", "externes", "recrutements"] as const) {
      const v = o[k];
      if (v === undefined || v === b[k]) continue;
      const diff = v - b[k];
      out.push(`${o.code} : ${LABEL[k]} ${b[k]} → ${v} (${diff > 0 ? "+" : ""}${diff})`);
    }
  }
  if (input.reservePct !== undefined && input.reservePct !== base.reservePct) out.push(`Réserve : ${base.reservePct} % → ${input.reservePct} %`);
  if (input.niveauxALiberer?.length) out.push(`Niveaux libérés : ${input.niveauxALiberer.map((f) => (f === "RDC" ? "RDC" : `niveau ${f}`)).join(", ")}`);
  return out;
}

function countByFloor(seats: readonly Seat[], dirOf: (s: Seat) => string, keep: (s: Seat) => boolean) {
  const out: Record<string, Record<string, number>> = {};
  for (const s of seats) {
    if (!keep(s)) continue;
    const d = dirOf(s);
    const f = (out[s.floor] ??= {});
    f[d] = (f[d] ?? 0) + 1;
  }
  return out;
}

/**
 * Lance la simulation : quotas et proposition avec les hypothèses modifiées, comparés au scénario de départ.
 * `baseZoneIds` : zones à libérer déjà propres au scénario de départ.
 */
export function simulate(seats: readonly Seat[], base: SimulationBase, raw: SimulationInput, baseZoneIds: Iterable<string> = []): SimulationResult {
  const input = simulationInputSchema.parse(raw);
  const baseZones = new Set(baseZoneIds);
  const floors = [...new Set(input.niveauxALiberer ?? [])];
  const freed = freedSeatIds(seats, floors).filter((id) => !baseZones.has(id));
  const zones = new Set([...baseZones, ...freed]);
  const params = applyOverrides(base.directions, input);
  const reservePct = input.reservePct ?? base.reservePct;

  const result = proposeAllocation(seats, params, { reservePct, extraZoneToFree: zones });

  // Scénario de départ : mêmes positions, hypothèses d'origine (quotas seulement, sans proposition).
  const inEq = new Set(base.directions.map((d) => d.code));
  const inBasePool = (s: Seat) => !s.zoneToFree && !baseZones.has(s.id) && s.groupCode !== "SUP" && s.direction !== "SUPPORT" && (s.direction === VIDE || inEq.has(s.direction));
  const poolBefore = seats.filter(inBasePool).length;
  const before = computeQuotas({ directions: base.directions, positionsToAllocate: poolBefore, reservePct: base.reservePct });
  const currentBefore: Record<string, number> = {};
  for (const s of seats) if (inBasePool(s) && inEq.has(s.direction)) currentBefore[s.direction] = (currentBefore[s.direction] ?? 0) + 1;

  const freedSet = new Set(freed);
  // Les positions des niveaux libérés sortent du pool : elles deviennent vides.
  const shownAfter = (s: Seat) => (freedSet.has(s.id) ? VIDE : (result.proposed.get(s.id) ?? s.direction));
  const changed: Record<string, string> = {};
  for (const s of seats) {
    const to = shownAfter(s);
    if (to !== s.direction) changed[s.id] = to;
  }
  const released = Object.values(changed).filter((d) => d === VIDE).length;

  return {
    titre: input.titre,
    reservePct,
    reservePctBefore: base.reservePct,
    niveauxALiberer: floors,
    rows: params.map((p) => ({
      code: p.code, cdi: p.cdi, externes: p.externes, recrutements: p.recrutements, fixedSeats: p.fixedSeats,
      targetBefore: before.targetHeadcount[p.code] ?? 0,
      targetAfter: result.targetHeadcount[p.code] ?? 0,
      current: currentBefore[p.code] ?? 0,
      quotaBefore: before.quotas[p.code] ?? 0,
      quotaAfter: result.quota[p.code] ?? 0,
    })),
    kpis: {
      positionsToAllocate: result.kpis.positionsToAllocate,
      positionsToAllocateBefore: before.alloc,
      reserve: result.kpis.reserve,
      targetHeadcount: result.kpis.targetHeadcount,
      targetHeadcountBefore: before.totalTargetHeadcount,
      rate: result.kpis.rate,
      rateBefore: before.rate,
      changes: result.kpis.changes,
      released,
      feasible: result.floorPlan.feasible,
    },
    floorsBefore: countByFloor(seats, (s) => s.direction, (s) => inBasePool(s)),
    floorsAfter: countByFloor(seats, shownAfter, (s) => inBasePool(s)),
    freedPositions: freed.length,
    changed,
    extraZoneIds: freed,
    hypotheses: describeHypotheses(base, input),
  };
}

/** Résumé compact renvoyé à l'assistant IA (résultat de l'outil) : il commente des chiffres calculés, jamais inventés. */
export function summarizeForAssistant(r: SimulationResult) {
  return {
    titre: r.titre,
    hypotheses: r.hypotheses,
    reservePct: r.reservePct,
    niveauxLiberes: r.niveauxALiberer,
    positionsLibereesParLesNiveaux: r.freedPositions,
    positionsARepartir: { avant: r.kpis.positionsToAllocateBefore, apres: r.kpis.positionsToAllocate },
    positionsEnReserve: r.kpis.reserve,
    effectifCible: { avant: r.kpis.targetHeadcountBefore, apres: r.kpis.targetHeadcount },
    positionsPour100Personnes: { avant: round1(r.kpis.rateBefore * 100), apres: round1(r.kpis.rate * 100) },
    positionsQuiChangentDeDirection: r.kpis.changes,
    repartitionParNiveauRealisable: r.kpis.feasible,
    directions: r.rows.map((x) => ({
      direction: x.code,
      effectifCible: { avant: x.targetBefore, apres: x.targetAfter },
      positionsOccupeesAujourdhui: x.current,
      quota: { avant: x.quotaBefore, apres: x.quotaAfter },
      ecartAvecAujourdhui: x.quotaAfter - x.current,
    })),
    positionsParNiveauApres: r.floorsAfter,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
