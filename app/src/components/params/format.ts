/** Fonctions pures d'affichage : écarts, taux, libellés. Sans dépendance à React, Prisma ni au DOM. */

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PROPOSED: "Proposé",
  VALIDATED: "Validé",
  PUBLISHED: "Publié",
};

export const SOURCE_LABELS: Record<string, string> = { SIRH: "SIRH", MAIL_CLIENT: "Mail client" };

/** Écart signé : +5, −3 (vrai signe moins), 0. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export type DeltaTone = "gain" | "loss" | "neutral";
/** Écart = quota − positions actuelles. Positif : la direction reçoit des positions ; négatif : elle en libère. */
export function deltaOf(quota: number, current: number): number {
  return quota - current;
}
export function deltaTone(delta: number): DeltaTone {
  return delta > 0 ? "gain" : delta < 0 ? "loss" : "neutral";
}

/** Effectif cible = CDI + consultants externes + recrutements comptés. */
export function targetHeadcount(p: { cdi: number; externes: number; recrutements: number }): number {
  return p.cdi + p.externes + p.recrutements;
}

/** Postes partagés = quota − postes fixes (jamais négatif). */
export function sharedSeats(quota: number, fixedSeats: number): number {
  return Math.max(0, quota - fixedSeats);
}

/** Effectif flexible = effectif cible − postes fixes (jamais négatif). */
export function flexHeadcount(target: number, fixedSeats: number): number {
  return Math.max(0, target - fixedSeats);
}

/**
 * Taux de présence moyen maximal = postes partagés / effectif flexible.
 * `null` quand il n'y a pas d'effectif flexible. Peut dépasser 1 (plus de postes que de personnes).
 */
export function maxPresenceRate(quota: number, fixedSeats: number, target: number): number | null {
  const flex = flexHeadcount(target, fixedSeats);
  if (flex <= 0) return null;
  return sharedSeats(quota, fixedSeats) / flex;
}

/** Taux commun = positions réparties / somme des effectifs cibles (0 si effectif nul). */
export function commonRate(allocated: number, totalTarget: number): number {
  return totalTarget > 0 ? allocated / totalTarget : 0;
}

/** Pourcentage à la française, une décimale : 0,784 -> « 78,4 % ». `null` -> « — ». */
export function formatPercent(rate: number | null, digits = 1): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits).replace(".", ",")} %`;
}

/** Taux avec deux décimales (positions par personne) : 1,02. */
export function formatRatio(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return rate.toFixed(2).replace(".", ",");
}

export function floorsLabel(floors: readonly string[] | undefined): string {
  return floors && floors.length ? floors.join(", ") : "—";
}

/** « RDC, 1 → RDC, 1, 3 ». */
export function floorsChange(before: readonly string[] | undefined, after: readonly string[] | undefined): string {
  return `${floorsLabel(before)} → ${floorsLabel(after)}`;
}

/** Saisie d'un entier positif ou nul. Renvoie la valeur ou un message d'erreur. */
export function parseCount(raw: string, max = 100000): { ok: true; value: number } | { ok: false; error: string } {
  const s = raw.trim();
  if (s === "") return { ok: false, error: "Valeur requise." };
  if (!/^\d+$/.test(s)) return { ok: false, error: "Entier positif ou nul attendu." };
  const value = Number(s);
  if (value > max) return { ok: false, error: `Maximum ${max}.` };
  return { ok: true, value };
}

export interface MovementLike {
  positionId: string;
  floor: string;
  island: number | null;
  from: string;
  to: string;
  r: number;
  c: number;
  kind: string;
}
export interface IslandGroup { island: number | null; movements: MovementLike[]; flows: { from: string; to: string; count: number }[] }
export interface FloorGroup { floor: string; total: number; islands: IslandGroup[] }

const FLOOR_ORDER = ["RDC", "1", "2", "3", "4"];
const floorRank = (f: string) => {
  const i = FLOOR_ORDER.indexOf(f);
  return i < 0 ? FLOOR_ORDER.length : i;
};

/** Regroupe les mouvements par niveau puis par îlot (numérotation du moteur), avec le détail des flux « de → vers ». */
export function groupMovements(movements: readonly MovementLike[]): FloorGroup[] {
  const byFloor = new Map<string, Map<number | null, MovementLike[]>>();
  for (const m of movements) {
    const fl = byFloor.get(m.floor) ?? new Map<number | null, MovementLike[]>();
    const list = fl.get(m.island) ?? [];
    list.push(m);
    fl.set(m.island, list);
    byFloor.set(m.floor, fl);
  }
  return [...byFloor.entries()]
    .sort((a, b) => floorRank(a[0]) - floorRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([floor, islands]) => {
      const groups = [...islands.entries()]
        .sort((a, b) => (a[0] ?? Infinity) - (b[0] ?? Infinity))
        .map(([island, list]) => {
          const flows = new Map<string, { from: string; to: string; count: number }>();
          for (const m of list) {
            const key = `${m.from}>${m.to}`;
            const f = flows.get(key) ?? { from: m.from, to: m.to, count: 0 };
            f.count += 1;
            flows.set(key, f);
          }
          return { island, movements: list, flows: [...flows.values()].sort((a, b) => b.count - a.count) };
        });
      return { floor, total: groups.reduce((s, g) => s + g.movements.length, 0), islands: groups };
    });
}

/** Nombre de positions qui changent de direction (hors libérations vers VIDE). */
export function countDirectionChanges(movements: readonly { to: string }[]): number {
  return movements.filter((m) => m.to !== "VIDE").length;
}
