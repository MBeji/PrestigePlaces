import { GROUP_CODES, directionOf } from "./groups";
import type { Aggregate, DiffRow, KindCounts, ParamChange } from "./types";

const total = (k: KindCounts) => k.d + k.m + k.c;
const withTotal = (k: KindCounts) => ({ ...k, total: total(k) });

/**
 * Compare deux agrégats par groupe. Sans stockage nominatif, les entrées et sorties
 * sont déduites des écarts par catégorie (D, M, C) : somme des hausses / des baisses.
 */
export function compareAggregates(prev: Aggregate | null, next: Aggregate): DiffRow[] {
  return GROUP_CODES.map((group) => {
    const a = prev?.[group] ?? { d: 0, m: 0, c: 0 };
    const b = next[group];
    let entrees = 0;
    let sorties = 0;
    for (const k of ["d", "m", "c"] as const) {
      const delta = b[k] - a[k];
      if (delta > 0) entrees += delta;
      else sorties -= delta;
    }
    return { group, direction: directionOf(group), avant: withTotal(a), apres: withTotal(b), ecart: total(b) - total(a), entrees, sorties };
  });
}

/** Valeurs cdi et postes fixes (D + M) par direction de l'équation (hors SUPPORT). */
export function paramsFromAggregate(agg: Aggregate): Record<string, { cdi: number; fixedSeats: number }> {
  const out: Record<string, { cdi: number; fixedSeats: number }> = {};
  for (const group of GROUP_CODES) {
    const dir = directionOf(group);
    if (dir === "SUPPORT") continue;
    const o = (out[dir] ??= { cdi: 0, fixedSeats: 0 });
    o.cdi += total(agg[group]);
    o.fixedSeats += agg[group].d + agg[group].m;
  }
  return out;
}

export function compareParams(
  current: Record<string, { cdi: number; fixedSeats: number }>,
  next: Record<string, { cdi: number; fixedSeats: number }>,
): ParamChange[] {
  return Object.entries(next).map(([direction, v]) => ({
    direction,
    cdiAvant: current[direction]?.cdi ?? null,
    cdiApres: v.cdi,
    fixesAvant: current[direction]?.fixedSeats ?? null,
    fixesApres: v.fixedSeats,
  }));
}
