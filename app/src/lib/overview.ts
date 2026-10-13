/**
 * Vue d'ensemble de la répartition (page d'accueil) : chiffres de paramétrage du site, quotas et preuves d'équité.
 * Fonctions pures, sans Prisma ni React : le service `getOverview` fournit les entrées.
 */
import { computeQuotas } from "@/lib/engine/quotas";

export interface OverviewDirectionInput {
  code: string;
  label: string;
  color: string;
  cdi: number;
  externes: number;
  /** Recrutements retenus (comptés dans l'effectif cible). */
  recrutements: number;
  fixedSeats: number;
  /** Positions occupées aujourd'hui dans le périmètre à répartir. */
  current: number;
}

export interface OverviewInput {
  directions: readonly OverviewDirectionInput[];
  /** Toutes les positions du site. */
  totalPositions: number;
  /** Positions des fonctions support (hors équation). */
  supportPositions: number;
  /** Positions des zones à libérer (salle de formation, zones du scénario). */
  zonePositions: number;
  /** Positions à répartir avant réserve. */
  poolPositions: number;
  reservePct: number;
}

export interface OverviewDirectionRow extends OverviewDirectionInput {
  targetHeadcount: number;
  /** Part de la direction dans l'effectif cible du site (0..1). */
  headcountShare: number;
  /** Positions attribuées (quota). */
  quota: number;
  /** Part de la direction dans les positions réparties (0..1). */
  seatShare: number;
  /** Positions par personne de l'effectif cible (quota / effectif cible). */
  seatsPerPerson: number | null;
  /** quota − positions actuelles. */
  delta: number;
  /** Le quota a été relevé au nombre de postes fixes. */
  floored: boolean;
}

export interface Overview {
  rows: OverviewDirectionRow[];
  totals: { cdi: number; externes: number; recrutements: number; targetHeadcount: number; quota: number; current: number; fixedSeats: number };
  totalPositions: number;
  supportPositions: number;
  zonePositions: number;
  poolPositions: number;
  reserve: number;
  /** Positions réellement réparties (pool − réserve). */
  allocated: number;
  /** Taux commun : positions réparties / effectif cible total. */
  commonRate: number;
  /** Plus grand écart, en points de positions par personne, entre une direction et le taux commun (arrondi et planchers). */
  maxGap: number;
}

/** Calcule les quotas (même règle que le moteur) et les indicateurs d'équité par direction. */
export function buildOverview(input: OverviewInput): Overview {
  const q = computeQuotas({
    directions: input.directions.map((d) => ({ code: d.code, cdi: d.cdi, externes: d.externes, recrutements: d.recrutements, fixedSeats: d.fixedSeats })),
    positionsToAllocate: input.poolPositions,
    reservePct: input.reservePct,
  });
  const total = q.totalTargetHeadcount;
  const quotaSum = input.directions.reduce((s, d) => s + (q.quotas[d.code] ?? 0), 0);
  const rows: OverviewDirectionRow[] = input.directions.map((d) => {
    const targetHeadcount = q.targetHeadcount[d.code] ?? 0;
    const quota = q.quotas[d.code] ?? 0;
    const proportional = total > 0 ? (q.alloc * targetHeadcount) / total : 0;
    return {
      ...d,
      targetHeadcount,
      headcountShare: total > 0 ? targetHeadcount / total : 0,
      quota,
      seatShare: quotaSum > 0 ? quota / quotaSum : 0,
      seatsPerPerson: targetHeadcount > 0 ? quota / targetHeadcount : null,
      delta: quota - d.current,
      floored: proportional < d.fixedSeats && quota === d.fixedSeats,
    };
  });
  const sum = (k: "cdi" | "externes" | "recrutements" | "current" | "fixedSeats") => input.directions.reduce((s, d) => s + d[k], 0);
  const maxGap = rows.reduce((m, r) => (r.seatsPerPerson === null ? m : Math.max(m, Math.abs(r.seatsPerPerson - q.rate))), 0);
  return {
    rows,
    totals: {
      cdi: sum("cdi"), externes: sum("externes"), recrutements: sum("recrutements"), targetHeadcount: total,
      quota: quotaSum, current: sum("current"), fixedSeats: sum("fixedSeats"),
    },
    totalPositions: input.totalPositions,
    supportPositions: input.supportPositions,
    zonePositions: input.zonePositions,
    poolPositions: input.poolPositions,
    reserve: q.reserve,
    allocated: q.alloc,
    commonRate: q.rate,
    maxGap,
  };
}

/** Nombre entier à la française : 1213 -> « 1 213 » (espace insécable fine). */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/\s/g, " ");
}
