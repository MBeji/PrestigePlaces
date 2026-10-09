import type { QuotaInput, QuotaResult } from "./types";

/**
 * Méthode du plus fort reste : répartit `total` unités entières proportionnellement à `weights`.
 * La somme du résultat vaut `total` (si la somme des poids est > 0, sinon tout vaut 0).
 * À reste égal, l'ordre d'entrée départage (tri stable).
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w * total) / sumW);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    base[i] += 1;
    rest -= 1;
  }
  return base;
}

/**
 * Quotas par direction : quota = alloc × effectif cible / Σ effectifs cibles, arrondi au plus fort reste,
 * jamais inférieur aux postes fixes (le surplus est repris sur les autres directions). alloc = pool − réserve, réserve = round(pool × réserve % / 100).
 */
export function computeQuotas(input: QuotaInput): QuotaResult {
  const P = Math.max(0, Math.floor(input.positionsToAllocate));
  const pct = Math.max(0, input.reservePct ?? 0);
  const reserve = Math.min(P, Math.round((P * pct) / 100));
  const alloc = P - reserve;
  const targetHeadcount: Record<string, number> = {};
  let total = 0;
  for (const d of input.directions) {
    const n = Math.max(0, d.cdi) + Math.max(0, d.externes) + Math.max(0, d.recrutements);
    targetHeadcount[d.code] = n;
    total += n;
  }
  // Plancher des postes fixes : une direction dont la part proportionnelle est inférieure à ses postes fixes
  // reçoit exactement ses postes fixes, et le reste est réparti entre les autres (itératif), afin que la somme
  // des quotas reste égale à alloc (la réserve n'est pas consommée). Si les postes fixes dépassent alloc,
  // chaque direction reçoit au moins ses postes fixes et la somme dépasse alloc (situation signalée par l'appelant).
  const fixed = input.directions.map((d) => Math.max(0, Math.floor(d.fixedSeats)));
  const clamped = new Set<number>();
  let q: number[] = [];
  for (;;) {
    const free = input.directions.map((_, i) => i).filter((i) => !clamped.has(i));
    const remaining = Math.max(0, alloc - [...clamped].reduce((s, i) => s + fixed[i], 0));
    const share = largestRemainder(free.map((i) => targetHeadcount[input.directions[i].code]), remaining);
    q = input.directions.map((_, i) => (clamped.has(i) ? fixed[i] : 0));
    free.forEach((i, j) => (q[i] = share[j]));
    const under = free.filter((i) => q[i] < fixed[i]);
    if (under.length === 0) break;
    for (const i of under) clamped.add(i);
  }
  const quotas: Record<string, number> = {};
  input.directions.forEach((d, i) => {
    quotas[d.code] = Math.max(q[i], fixed[i]);
  });
  return { quotas, targetHeadcount, totalTargetHeadcount: total, rate: total > 0 ? alloc / total : 0, alloc, reserve };
}
