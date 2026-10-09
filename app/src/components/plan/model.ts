/**
 * Modèle pur des plans (sans React ni Prisma) : fusion situation / proposition, construction des formes SVG,
 * résumé par direction, textes de détail et navigation clavier. Reprend renderPlan() du prototype.
 */

export type PlanView = "situation" | "proposition" | "changements";
export const PLAN_VIEWS: readonly { id: PlanView; label: string }[] = [
  { id: "situation", label: "Situation" },
  { id: "proposition", label: "Proposition" },
  { id: "changements", label: "Changements" },
];
export function isPlanView(v: unknown): v is PlanView {
  return v === "situation" || v === "proposition" || v === "changements";
}

export const VIDE = "VIDE";
export const SUPPORT = "SUPPORT";
export const ZONE_A_LIBERER = "ZONE_A_LIBERER";

export interface DirectionStyle { code: string; label: string; color: string; inEquation: boolean }

export interface PlanCellInput { r: number; c: number; type: string }

/** Position telle que fournie par getFloorPlan (service plans). */
export interface FloorPositionInput {
  id: string; r: number; c: number; kind: string; type: string; groupCode: string; zoneToFree: boolean;
  islandIndex: number | null; directionCode: string;
}
export interface FloorPlanInput {
  floor: { code: string; label: string };
  cells: PlanCellInput[];
  positions: FloorPositionInput[];
}

/** Position prête à dessiner : direction actuelle et proposée (null sans proposition). */
export interface PlanPosition {
  id: string; r: number; c: number; kind: string; groupCode: string;
  /** Index d'îlot en base (0..n-1). */
  islandIndex: number | null;
  /** Zone à libérer permanente (centre du RDC). */
  zoneToFree: boolean;
  /** Zone à libérer propre au scénario. */
  extraZone: boolean;
  current: string;
  proposed: string | null;
}
export interface FloorPlanData { code: string; label: string; cells: PlanCellInput[]; positions: PlanPosition[] }

/**
 * Fusionne le plan d'un niveau dans le scénario source (situation) et, s'il existe, dans sa proposition
 * (scénario dérivé). Les positions sont appariées par identifiant.
 */
export function mergeFloorPlans(situation: FloorPlanInput, proposal: FloorPlanInput | null, extraZoneIds: Iterable<string> = []): FloorPlanData {
  const proposed = proposal ? new Map(proposal.positions.map((p) => [p.id, p.directionCode])) : null;
  const extra = new Set(extraZoneIds);
  return {
    code: situation.floor.code,
    label: situation.floor.label,
    cells: situation.cells.map((c) => ({ r: c.r, c: c.c, type: c.type })),
    positions: situation.positions.map((p) => ({
      id: p.id, r: p.r, c: p.c, kind: p.kind, groupCode: p.groupCode, islandIndex: p.islandIndex,
      zoneToFree: p.zoneToFree, extraZone: extra.has(p.id),
      current: p.directionCode,
      proposed: proposed ? (proposed.get(p.id) ?? VIDE) : null,
    })),
  };
}

export const KIND_LABEL: Record<string, string> = { d: "directeur", m: "manager", c: "collaborateur", e: "consultant externe" };
export const CELL_SIZE = 14;

export const isFixed = (p: { kind: string }) => p.kind === "d" || p.kind === "m";
/** Direction affichée selon la vue (la proposition à défaut retombe sur la situation). */
export const shownDirection = (p: PlanPosition, view: PlanView) => (view === "situation" || p.proposed === null ? p.current : p.proposed);
export const hasChanged = (p: PlanPosition) => p.proposed !== null && p.proposed !== p.current;

export function directionLabel(code: string, directions: readonly DirectionStyle[]): string {
  if (code === VIDE) return "Vide";
  if (code === ZONE_A_LIBERER) return "Zone à libérer";
  return directions.find((d) => d.code === code)?.label ?? code;
}

export function directionColor(code: string, directions: readonly DirectionStyle[]): string {
  if (code === VIDE) return "var(--c-vide)";
  return directions.find((d) => d.code === code)?.color ?? "var(--c-vide)";
}

export type CellShapeKind = "wall" | "room" | "green" | "office" | "desk" | "training";
export interface CellShape { key: string; x: number; y: number; kind: CellShapeKind }
export interface SeatShape {
  id: string; r: number; c: number; x: number; y: number;
  /** Couleur de remplissage, ou « support » (hachures) ou « zone » (zone à libérer du scénario). */
  fill: string;
  pattern: "support" | "zone" | null;
  outline: "fixed" | "changed" | null;
  dim: boolean;
  mark: "D" | "M" | null;
  shown: string;
  changed: boolean;
  label: string;
}
export interface PlanModel {
  width: number; height: number; r0: number; c0: number;
  cells: CellShape[];
  seats: SeatShape[];
  /** Zone à libérer permanente du niveau (centre du RDC) : nombre de positions et centre du libellé. */
  zone: { count: number; x: number; y: number } | null;
  changes: number;
}

const CELL_KIND: Record<string, CellShapeKind | undefined> = {
  wall: "wall", room: "room", green: "green", office: "office", desk: "desk", free_m: "desk", free: "training",
};

/** Construit les formes du plan d'un niveau pour une vue. */
export function buildPlanModel(data: FloorPlanData, view: PlanView, directions: readonly DirectionStyle[]): PlanModel {
  const all = [...data.cells, ...data.positions];
  const r0 = all.length ? Math.min(...all.map((x) => x.r)) : 0;
  const c0 = all.length ? Math.min(...all.map((x) => x.c)) : 0;
  const r1 = all.length ? Math.max(...all.map((x) => x.r)) : 0;
  const c1 = all.length ? Math.max(...all.map((x) => x.c)) : 0;
  const S = CELL_SIZE;
  const X = (c: number) => (c - c0) * S;
  const Y = (r: number) => (r - r0) * S;

  const cells: CellShape[] = [];
  for (const cell of data.cells) {
    const kind = CELL_KIND[cell.type];
    if (kind) cells.push({ key: `${cell.r}:${cell.c}`, x: X(cell.c), y: Y(cell.r), kind });
  }
  const zonePositions = data.positions.filter((p) => p.zoneToFree);
  for (const p of zonePositions) cells.push({ key: `z${p.r}:${p.c}`, x: X(p.c), y: Y(p.r), kind: "training" });

  let changes = 0;
  const seats: SeatShape[] = [];
  for (const p of data.positions) {
    if (p.zoneToFree) continue;
    const shown = shownDirection(p, view);
    const changed = hasChanged(p);
    if (changed && p.proposed !== VIDE) changes++;
    const fixed = isFixed(p);
    const freedZone = p.extraZone && view !== "situation" && p.proposed !== null;
    seats.push({
      id: p.id, r: p.r, c: p.c, x: X(p.c), y: Y(p.r),
      fill: directionColor(shown, directions),
      pattern: freedZone ? "zone" : shown === SUPPORT ? "support" : null,
      outline: fixed ? "fixed" : changed && view !== "situation" ? "changed" : null,
      dim: view === "changements" && !changed,
      mark: fixed ? (p.kind === "d" ? "D" : "M") : null,
      shown, changed,
      label: seatLabel(p, view, directions),
    });
  }

  let zone: PlanModel["zone"] = null;
  if (zonePositions.length) {
    const cx = zonePositions.reduce((a, p) => a + p.c, 0) / zonePositions.length;
    const cy = zonePositions.reduce((a, p) => a + p.r, 0) / zonePositions.length;
    zone = { count: zonePositions.length, x: X(cx) + S / 2, y: Y(cy) + S / 2 };
  }

  return { width: (c1 - c0 + 1) * S, height: (r1 - r0 + 1) * S, r0, c0, cells, seats, zone, changes };
}

/** Libellé court (lecteur d'écran) d'une position dans une vue. */
export function seatLabel(p: PlanPosition, view: PlanView, directions: readonly DirectionStyle[]): string {
  const parts = [`Ligne ${p.r}, colonne ${p.c}`, directionLabel(shownDirection(p, view), directions)];
  if (isFixed(p)) parts.push(`poste fixe (${KIND_LABEL[p.kind]})`);
  if (view !== "situation" && hasChanged(p)) parts.push(`change : ${directionLabel(p.current, directions)} vers ${directionLabel(p.proposed!, directions)}`);
  return parts.join(", ");
}

export interface SeatDetail { term: string; value: string }
/** Détail d'une position (panneau). */
export function seatDetails(p: PlanPosition, floorLabel: string, directions: readonly DirectionStyle[]): SeatDetail[] {
  const proposition =
    p.proposed === null ? "aucune proposition calculée"
    : hasChanged(p) ? `${directionLabel(p.proposed, directions)} (au lieu de ${directionLabel(p.current, directions)})`
    : "inchangée";
  const rows: SeatDetail[] = [
    { term: "Niveau", value: floorLabel },
    { term: "Ligne", value: String(p.r) },
    { term: "Colonne", value: String(p.c) },
    { term: "Îlot", value: p.islandIndex === null ? "—" : String(p.islandIndex + 1) },
    { term: "Groupe", value: p.groupCode === "V" ? "vide" : p.groupCode },
    { term: "Direction", value: directionLabel(p.current, directions) },
    { term: "Catégorie", value: `${KIND_LABEL[p.kind] ?? p.kind}${isFixed(p) ? ", poste fixe" : ""}` },
    { term: "Proposition", value: proposition },
  ];
  if (p.extraZone) rows.push({ term: "Zone", value: "à libérer dans ce scénario" });
  return rows;
}

export interface FloorSummaryRow { code: string; label: string; color: string; before: number; after: number }
/** Résumé par direction du niveau, avant → après (positions hors zone à libérer). */
export function summarizeFloor(data: FloorPlanData, directions: readonly DirectionStyle[]): FloorSummaryRow[] {
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  for (const p of data.positions) {
    if (p.zoneToFree) continue;
    before.set(p.current, (before.get(p.current) ?? 0) + 1);
    const a = p.proposed ?? p.current;
    after.set(a, (after.get(a) ?? 0) + 1);
  }
  const order = [...directions.filter((d) => d.inEquation).map((d) => d.code), VIDE, ...directions.filter((d) => !d.inEquation).map((d) => d.code)];
  for (const k of [...before.keys(), ...after.keys()]) if (!order.includes(k)) order.push(k);
  return order
    .filter((code) => before.has(code) || after.has(code))
    .map((code) => ({ code, label: directionLabel(code, directions), color: directionColor(code, directions), before: before.get(code) ?? 0, after: after.get(code) ?? 0 }));
}

export type NavKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";
/** Position voisine pour la navigation au clavier (la plus proche dans la direction de la flèche). */
export function nextSeat<T extends { id: string; r: number; c: number }>(seats: readonly T[], fromId: string | null, key: NavKey): T | null {
  if (!seats.length) return null;
  const sorted = [...seats].sort((a, b) => a.r - b.r || a.c - b.c);
  if (key === "Home") return sorted[0];
  if (key === "End") return sorted[sorted.length - 1];
  const from = seats.find((s) => s.id === fromId);
  if (!from) return sorted[0];
  let best: T | null = null;
  let bestScore = Infinity;
  for (const s of seats) {
    const dr = s.r - from.r, dc = s.c - from.c;
    const [main, side] = key === "ArrowRight" ? [dc, dr] : key === "ArrowLeft" ? [-dc, dr] : key === "ArrowDown" ? [dr, dc] : [-dr, dc];
    if (main <= 0) continue;
    const score = main + 2 * Math.abs(side);
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}
