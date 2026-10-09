import { minCostFlow, type FlowEdge } from "./flow";
import { islands as computeIslandMap } from "./islands";
import { computeQuotas } from "./quotas";
import { DEFAULT_FLOORS, SUPPORT, VIDE, type DirectionParam, type Movement, type Proposal, type ProposeOptions, type Seat } from "./types";

const cheb = (a: { r: number; c: number }, b: { r: number; c: number }) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
const key = (d: string, f: string) => `${d}|${f}`;

/** Contexte de la répartition par niveau. Les clés des tables sont `direction|niveau`. */
export interface FloorContext {
  floors: readonly string[];
  /** Directions excédentaires (delta < 0) et déficitaires (delta > 0). */
  surplus: string[];
  deficit: string[];
  /** Positions non fixes d'une direction sur un niveau (libérables). */
  movable: Record<string, number>;
  /** Positions occupées par une direction sur un niveau. */
  present: Record<string, number>;
  /** Positions vides par niveau. */
  vides: Record<string, number>;
  /** Écart quota − actuel par direction. */
  delta: Record<string, number>;
  reserve: number;
  /** Rang de libération d'un niveau pour une direction excédentaire (0 = niveau le moins occupé). */
  rank: Record<string, number>;
}

export interface FloorSolution {
  feasible: boolean;
  cost: number;
  release: Record<string, number>;
  gain: Record<string, number>;
  toReserve: Record<string, number>;
}

/**
 * Répartition par niveau par flot à coût minimal : les directions excédentaires libèrent des positions
 * (coût = rang du niveau), les vides s'y ajoutent, les directions déficitaires reprennent sur les niveaux
 * autorisés (0 si elles y sont déjà, 100 pour un nouveau niveau), le reste part en réserve (coût 10).
 */
export function solveFloors(ctx: FloorContext, allowed: Record<string, Set<string>>): FloorSolution {
  const { floors, surplus, deficit, movable, present, vides, delta, reserve, rank } = ctx;
  const idS: Record<string, number> = {};
  const idF: Record<string, number> = {};
  const idD: Record<string, number> = {};
  let nid = 2;
  for (const d of surplus) idS[d] = nid++;
  for (const f of floors) idF[f] = nid++;
  for (const d of deficit) idD[d] = nid++;
  const idR = nid++;
  type Tag = { kind: "release" | "gain"; d: string; f: string } | { kind: "vide" | "reserve"; f: string } | null;
  const edges: FlowEdge[] = [];
  const tags: Tag[] = [];
  const add = (u: number, v: number, cap: number, cost: number, t: Tag) => {
    if (cap > 0) {
      edges.push({ u, v, cap, cost });
      tags.push(t);
    }
  };
  for (const d of surplus) add(0, idS[d], -delta[d], 0, null);
  for (const d of surplus) for (const f of floors) add(idS[d], idF[f], movable[key(d, f)] ?? 0, rank[key(d, f)] || 0, { kind: "release", d, f });
  for (const f of floors) add(0, idF[f], vides[f] ?? 0, 0, { kind: "vide", f });
  for (const f of floors)
    for (const d of deficit) if (allowed[d]?.has(f)) add(idF[f], idD[d], 10000, (present[key(d, f)] ?? 0) > 0 ? 0 : 100, { kind: "gain", d, f });
  for (const f of floors) add(idF[f], idR, 10000, 10, { kind: "reserve", f });
  for (const d of deficit) add(idD[d], 1, delta[d], 0, null);
  add(idR, 1, reserve, 0, null);
  const { flow, used } = minCostFlow(nid, 0, 1, edges);
  const need = deficit.reduce((a, d) => a + delta[d], 0) + reserve;
  let cost = 0;
  const release: Record<string, number> = {};
  const gain: Record<string, number> = {};
  const toReserve: Record<string, number> = {};
  used.forEach((x, i) => {
    const t = tags[i];
    if (!t || x <= 0) return;
    cost += x * edges[i].cost;
    if (t.kind === "release") release[key(t.d, t.f)] = x;
    else if (t.kind === "gain") gain[key(t.d, t.f)] = x;
    else if (t.kind === "reserve") toReserve[t.f] = x;
  });
  return { feasible: flow >= need, cost, release, gain, toReserve };
}

function floorOrder(seats: readonly Seat[], floors?: string[]): string[] {
  const out: string[] = [...(floors ?? DEFAULT_FLOORS)];
  for (const s of seats) if (!out.includes(s.floor)) out.push(s.floor);
  return out;
}

/**
 * Proposition d'affectation (portage de `propose()` du prototype).
 *
 * 1. Pool = positions hors SUPPORT, hors zones à libérer et hors directions absentes de `directionParams`.
 * 2. Quotas au plus fort reste (voir `computeQuotas`), delta = quota − positions actuelles.
 * 3. Répartition par niveau : chaque direction déficitaire garde ses niveaux et peut en ouvrir au plus un
 *    nouveau ; on énumère ces choix et on garde le flot réalisable de coût minimal.
 * 4. Choix des positions : on libère au bord des équipes qui cèdent et au plus près des équipes qui
 *    reprennent, puis chaque direction déficitaire reprend les positions libres les plus proches des siennes.
 *
 * Les postes fixes (d, m) et réservés ne changent jamais de direction.
 */
export function proposeAllocation(seats: readonly Seat[], directionParams: readonly DirectionParam[], options: ProposeOptions = {}): Proposal {
  const FLOORS = floorOrder(seats, options.floors);
  const floorIdx = new Map(FLOORS.map((f, i) => [f, i]));
  const extraZone = new Set(options.extraZoneToFree ?? []);
  const DIRS = directionParams.map((d) => d.code);
  const inEq = new Set(DIRS);
  const isZone = (s: Seat) => s.zoneToFree || extraZone.has(s.id);
  // ordre canonique : niveau, ligne, colonne (c'est l'ordre des cellules de situation.json)
  const sorted = [...seats].sort((a, b) => (floorIdx.get(a.floor) ?? 0) - (floorIdx.get(b.floor) ?? 0) || a.r - b.r || a.c - b.c);
  // Les positions du groupe SUP sont hors équation même si elles sont vides : elles ne bougent jamais.
  const pool = sorted.filter((s) => !isZone(s) && s.groupCode !== "SUP" && s.direction !== SUPPORT && (s.direction === VIDE || inEq.has(s.direction)));
  const locked = (s: Seat) => s.fixed || s.reserved === true;

  const missing = sorted.filter((s) => s.island === undefined && !isZone(s));
  const computed = missing.length ? computeIslandMap(sorted.filter((s) => !isZone(s))) : new Map<string, number>();
  const zoneIslands = computeIslandMap(sorted.filter(isZone));
  const islandOf = new Map<string, number>();
  for (const s of sorted) islandOf.set(s.id, s.island ?? (isZone(s) ? zoneIslands.get(s.id) : computed.get(s.id)) ?? 0);

  const P = pool.length;
  const q = computeQuotas({ directions: [...directionParams], positionsToAllocate: P, reservePct: options.reservePct ?? 0 });
  const { quotas: quota, reserve, alloc } = q;
  const current: Record<string, number> = {};
  for (const d of DIRS) current[d] = 0;
  for (const s of pool) if (current[s.direction] !== undefined) current[s.direction] += 1;
  const delta: Record<string, number> = {};
  for (const d of DIRS) delta[d] = quota[d] - current[d];

  const surplus = DIRS.filter((d) => delta[d] < 0);
  const deficit = DIRS.filter((d) => delta[d] > 0);
  const movable: Record<string, number> = {};
  const present: Record<string, number> = {};
  const vides: Record<string, number> = {};
  const rank: Record<string, number> = {};
  for (const f of FLOORS) {
    vides[f] = 0;
    for (const d of DIRS) {
      movable[key(d, f)] = 0;
      present[key(d, f)] = 0;
    }
  }
  for (const s of pool) {
    if (s.direction === VIDE) {
      vides[s.floor] += 1;
      continue;
    }
    present[key(s.direction, s.floor)] += 1;
    if (!locked(s)) movable[key(s.direction, s.floor)] += 1;
  }
  for (const d of surplus)
    FLOORS.filter((f) => movable[key(d, f)] > 0)
      .sort((a, b) => present[key(d, a)] - present[key(d, b)])
      .forEach((f, i) => {
        rank[key(d, f)] = i;
      });
  const ctx: FloorContext = { floors: FLOORS, surplus, deficit, movable, present, vides, delta, reserve, rank };
  const supplyOn = (f: string) => vides[f] + surplus.reduce((a, d) => a + movable[key(d, f)], 0);
  const maxCand = options.maxNewFloorCandidates ?? 4;
  const choices: (string | null)[][] = deficit.map((d) => [
    null,
    ...FLOORS.filter((f) => present[key(d, f)] === 0 && supplyOn(f) > 0)
      .sort((a, b) => supplyOn(b) - supplyOn(a))
      .slice(0, maxCand),
  ]);
  let best: FloorSolution | null = null;
  const walk = (i: number, choice: (string | null)[]) => {
    if (i === deficit.length) {
      const allowed: Record<string, Set<string>> = {};
      deficit.forEach((d, j) => {
        allowed[d] = new Set(FLOORS.filter((f) => present[key(d, f)] > 0));
        const c = choice[j];
        if (c) allowed[d].add(c);
      });
      const sol = solveFloors(ctx, allowed);
      if (sol.feasible && (!best || sol.cost < best.cost)) best = sol;
      return;
    }
    for (const o of choices[i]) walk(i + 1, [...choice, o]);
  };
  walk(0, []);
  let chosen: FloorSolution;
  if (best) chosen = best;
  else {
    const allowed: Record<string, Set<string>> = {};
    for (const d of deficit) allowed[d] = new Set(FLOORS);
    chosen = solveFloors(ctx, allowed);
  }
  const { release, gain } = chosen;

  // positions : libération au bord des équipes, reprise au plus près
  const proposed = new Map<string, string>();
  for (const s of sorted) proposed.set(s.id, s.direction);
  for (const f of FLOORS) {
    const onFloor = pool.filter((s) => s.floor === f);
    if (!onFloor.length) continue;
    const gainers = deficit.filter((d) => gain[key(d, f)]);
    const freed = onFloor.filter((s) => s.direction === VIDE);
    const anchorsOf = (d: string) => {
      const a = onFloor.filter((s) => s.direction === d);
      return a.length ? a : freed;
    };
    for (const d of surplus) {
      const n = release[key(d, f)] || 0;
      if (!n) continue;
      const mine = onFloor.filter((s) => s.direction === d && !locked(s));
      const gainerAnchors = gainers.map(anchorsOf);
      const score = (s: Seat) => {
        let near = 0;
        if (gainerAnchors.length) {
          near = Infinity;
          for (const a of gainerAnchors) {
            let m = 30;
            if (a.length) {
              m = Infinity;
              for (const x of a) m = Math.min(m, cheb(s, x));
            }
            near = Math.min(near, m);
          }
        }
        let own = 0;
        for (const x of mine) if (x !== s && cheb(s, x) <= 2) own += 1;
        return near * 10 + own;
      };
      mine
        .map((s) => [score(s), s] as const)
        .sort((a, b) => a[0] - b[0])
        .slice(0, n)
        .forEach(([, s]) => {
          proposed.set(s.id, VIDE);
          freed.push(s);
        });
    }
    const takers = gainers.map((d) => ({ d, n: gain[key(d, f)] })).sort((a, b) => b.n - a.n);
    for (const { d, n } of takers) {
      const anchors = onFloor.filter((s) => s.direction === d);
      const left = freed.filter((s) => proposed.get(s.id) === VIDE);
      const seed = anchors.length ? null : (left.slice().sort((a, b) => a.r - b.r || a.c - b.c)[0] ?? null);
      const dist = (s: Seat) => {
        if (anchors.length) {
          let m = Infinity;
          for (const x of anchors) m = Math.min(m, cheb(s, x));
          return m;
        }
        return seed ? cheb(s, seed) : 0;
      };
      left
        .map((s) => [dist(s), s] as const)
        .sort((a, b) => a[0] - b[0])
        .slice(0, n)
        .forEach(([, s]) => {
          proposed.set(s.id, d);
        });
    }
  }

  const movements: Movement[] = [];
  let changes = 0;
  for (const s of sorted) {
    const to = proposed.get(s.id)!;
    if (to === s.direction) continue;
    movements.push({ seatId: s.id, floor: s.floor, island: islandOf.get(s.id) ?? 0, from: s.direction, to });
    if (to !== VIDE) changes += 1;
  }
  movements.sort((a, b) => (floorIdx.get(a.floor) ?? 0) - (floorIdx.get(b.floor) ?? 0) || a.island - b.island);

  const floorsOf = (which: "before" | "after") => {
    const out: Record<string, string[]> = {};
    for (const d of [...DIRS, SUPPORT]) {
      const set = new Set<string>();
      for (const s of sorted) if ((which === "before" ? s.direction : proposed.get(s.id)) === d) set.add(s.floor);
      out[d] = FLOORS.filter((f) => set.has(f));
    }
    return out;
  };

  return {
    quota,
    current,
    delta,
    targetHeadcount: q.targetHeadcount,
    proposed,
    movements,
    islands: islandOf,
    floorPlan: { release, gain, toReserve: chosen.toReserve, feasible: chosen.feasible },
    kpis: {
      positionsToAllocate: alloc,
      reserve,
      targetHeadcount: q.totalTargetHeadcount,
      rate: q.rate,
      changes,
      floorsBefore: floorsOf("before"),
      floorsAfter: floorsOf("after"),
    },
  };
}
