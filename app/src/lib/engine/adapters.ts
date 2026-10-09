import { EMPTY_GROUP, FORMATION_GROUP, GROUP_DIRECTION } from "../directions";
import { DEFAULT_FLOORS, VIDE, type DirectionParam, type Seat, type SeatKind } from "./types";

/** Forme minimale de data/situation.json lue par le moteur. */
export interface SituationJson {
  groups: Record<string, { label?: string; direction?: string; cdi: { d: number; m: number; c: number }; recrutements: number; externes: number }>;
  floors: Record<string, { label?: string; cells: { r: number; c: number; t: string; g?: string; k?: string }[] }>;
}

const asKind = (k: string | undefined): SeatKind => (k === "d" || k === "m" || k === "e" ? k : "c");

/** Direction d'un code de groupe (V et inconnus → VIDE). */
export function directionOfGroup(groupCode: string): string {
  if (groupCode === EMPTY_GROUP || groupCode === FORMATION_GROUP) return VIDE;
  return GROUP_DIRECTION[groupCode] ?? VIDE;
}

/**
 * Construit les positions depuis data/situation.json : une Seat par cellule `seat` (id `NIVEAU:r:c`).
 * Avec `includeZoneToFree` (vrai par défaut), ajoute la zone à libérer du RDC : les cellules `free`
 * du RDC et la cellule `free_m` de la ligne 20 (la plus à gauche), groupe FORMATION, direction VIDE,
 * `zoneToFree: true`.
 */
export function loadSeatsFromSituation(json: SituationJson, opts: { includeZoneToFree?: boolean } = {}): Seat[] {
  const includeZone = opts.includeZoneToFree ?? true;
  const floors = [...DEFAULT_FLOORS.filter((f) => json.floors[f]), ...Object.keys(json.floors).filter((f) => !(DEFAULT_FLOORS as readonly string[]).includes(f))];
  const seats: Seat[] = [];
  for (const f of floors) {
    const cells = json.floors[f].cells;
    for (const x of cells) {
      if (x.t !== "seat") continue;
      const g = x.g ?? EMPTY_GROUP;
      const kind = asKind(x.k);
      seats.push({ id: `${f}:${x.r}:${x.c}`, floor: f, r: x.r, c: x.c, groupCode: g, kind, direction: directionOfGroup(g), fixed: kind === "d" || kind === "m", zoneToFree: false });
    }
    if (includeZone && f === "RDC") {
      const zone = (x: { r: number; c: number }, kind: SeatKind): Seat => ({ id: `${f}:${x.r}:${x.c}`, floor: f, r: x.r, c: x.c, groupCode: FORMATION_GROUP, kind, direction: VIDE, fixed: false, zoneToFree: true });
      for (const x of cells.filter((y) => y.t === "free")) seats.push(zone(x, "c"));
      const fm = cells.filter((y) => y.t === "free_m" && y.r === 20).sort((a, b) => a.c - b.c)[0];
      if (fm) seats.push(zone(fm, "m"));
    }
  }
  return seats;
}

/**
 * Paramètres par direction tirés de situation.json : CDI (d + m + c), externes, recrutements,
 * postes fixes (d + m), dans l'ordre des directions passé (défaut AMMAR, BOUBAKER, ZEINEB, AMINE, BEJI).
 */
export function directionParamsFromSituation(json: SituationJson, order: readonly string[] = ["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI"]): DirectionParam[] {
  const acc = new Map<string, DirectionParam>(order.map((code) => [code, { code, cdi: 0, externes: 0, recrutements: 0, fixedSeats: 0 }]));
  for (const [g, info] of Object.entries(json.groups)) {
    const p = acc.get(GROUP_DIRECTION[g] ?? "");
    if (!p) continue;
    p.cdi += info.cdi.d + info.cdi.m + info.cdi.c;
    p.externes += info.externes;
    p.recrutements += info.recrutements;
    p.fixedSeats += info.cdi.d + info.cdi.m;
  }
  return [...acc.values()];
}

/** Ligne Position minimale (Prisma ou équivalent). Le niveau vient de `floorCode` ou de `floor.code`. */
export interface PositionRow {
  id: string;
  r: number;
  c: number;
  kind: string;
  groupCode: string;
  zoneToFree: boolean;
  reserved?: boolean;
  floorCode?: string;
  floor?: { code: string } | null;
}

/** Ligne Assignment minimale (Prisma ou équivalent) d'un scénario. */
export interface AssignmentRow {
  positionId: string;
  directionCode: string;
}

/**
 * Adaptateur Prisma : construit les Seat d'un scénario depuis ses Position (avec `floor` inclus ou
 * `floorCode`) et ses Assignment. Sans affectation, la position est VIDE. Les positions du groupe
 * FORMATION ou marquées `zoneToFree` sont des zones à libérer. Les îlots sont recalculés par le moteur.
 */
export function seatsFromPositions(positions: readonly PositionRow[], assignments: readonly AssignmentRow[]): Seat[] {
  const byPos = new Map(assignments.map((a) => [a.positionId, a.directionCode]));
  return positions.map((p) => {
    const kind = asKind(p.kind);
    const floor = p.floorCode ?? p.floor?.code;
    if (!floor) throw new Error(`Position ${p.id} sans niveau (floorCode ou floor.code attendu)`);
    const zoneToFree = p.zoneToFree || p.groupCode === FORMATION_GROUP;
    return {
      id: p.id,
      floor,
      r: p.r,
      c: p.c,
      groupCode: p.groupCode,
      kind,
      direction: zoneToFree ? VIDE : (byPos.get(p.id) ?? VIDE),
      fixed: kind === "d" || kind === "m",
      zoneToFree,
      reserved: p.reserved ?? false,
    };
  });
}
