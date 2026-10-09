/**
 * Modèle pur de la vue 3D (sans React, sans Three.js, sans WebGL) : géométrie des niveaux empilés,
 * instances des positions (hauteur, couleur, atténuation), comptes par niveau et par direction,
 * open spaces (îlots) avant → après, ancres d'étiquettes et projection à l'écran.
 * Reprend build3D(), paintSeats(), placeLabels(), renderFloorTable() et renderIslands3D() du prototype.
 */
import { islands as computeEngineIslands } from "@/lib/engine/islands";
import {
  directionLabel, hasChanged, isFixed, KIND_LABEL, shownDirection, SUPPORT, VIDE,
  type DirectionStyle, type FloorPlanData, type PlanPosition, type PlanView,
} from "@/components/plan/model";

/** Écart vertical entre deux niveaux : vue éclatée et vue compacte. */
export const EXPLODED_GAP = 13;
export const COMPACT_GAP = 2.6;
/** Hauteur des positions : poste standard, poste fixe (directeur, manager), surélévation d'un changement. */
export const SEAT_HEIGHT = 1;
export const FIXED_SEAT_HEIGHT = 1.9;
export const CHANGE_LIFT = 0.9;
/** Part d'atténuation (vers la couleur de fond) des positions inchangées en vue changements. */
export const DIM_AMOUNT = 0.75;
/** Rayon de caméra par défaut : tous les niveaux, niveau isolé. */
export const RADIUS_ALL = 110;
export const RADIUS_FLOOR = 70;
export const RADIUS_MIN = 28;
export const RADIUS_MAX = 260;
/** En dessous de ce rayon, les étiquettes d'îlots s'affichent même avec tous les niveaux. */
export const ISLAND_LABEL_RADIUS = 95;
/** Taille minimale d'un îlot pour porter une étiquette. */
export const ISLAND_LABEL_MIN_SIZE = 4;
export const ALL_FLOORS = "ALL";

export type Focus = typeof ALL_FLOORS | string;

/** Emprise commune des plans (toutes cellules et positions de tous les niveaux). */
export interface GridBounds { r0: number; c0: number; nr: number; nc: number }

export function gridBounds(floors: readonly FloorPlanData[]): GridBounds {
  let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
  for (const f of floors)
    for (const x of [...f.cells, ...f.positions]) {
      if (x.r < r0) r0 = x.r;
      if (x.c < c0) c0 = x.c;
      if (x.r > r1) r1 = x.r;
      if (x.c > c1) c1 = x.c;
    }
  if (!Number.isFinite(r0)) return { r0: 0, c0: 0, nr: 1, nc: 1 };
  return { r0, c0, nr: r1 - r0 + 1, nc: c1 - c0 + 1 };
}

/** Altitude du plancher d'un niveau (index 0 = RDC). */
export function floorElevation(index: number, exploded: boolean): number {
  return index * (exploded ? EXPLODED_GAP : COMPACT_GAP);
}

/** Codes des niveaux affichés pour un focus (tous, ou un seul). */
export function visibleFloorCodes(floors: readonly FloorPlanData[], focus: Focus): string[] {
  if (focus === ALL_FLOORS || !floors.some((f) => f.code === focus)) return floors.map((f) => f.code);
  return [focus];
}

/**
 * Numéro d'îlot (1..n par niveau, comme le moteur et la liste des mouvements de la proposition) de chaque
 * position affectable (hors zone à libérer permanente). Clé : identifiant de position.
 */
export function islandNumbers(floors: readonly FloorPlanData[]): Map<string, number> {
  const seats = floors.flatMap((f) => f.positions.filter((p) => !p.zoneToFree).map((p) => ({ id: p.id, floor: f.code, r: p.r, c: p.c })));
  return computeEngineIslands(seats);
}

/** Instance d'une position dans le maillage instancié. */
export interface SeatInstance {
  id: string;
  floor: string;
  floorLabel: string;
  island: number | null;
  /** Centre au sol (coordonnées monde : x = colonne, z = ligne, y = altitude du plancher). */
  x: number; y: number; z: number;
  height: number;
  /** Direction affichée selon la vue : sert à la couleur. */
  shown: string;
  current: string;
  proposed: string | null;
  changed: boolean;
  /** Atténuée (vue changements, position inchangée). */
  dim: boolean;
  fixed: boolean;
  kind: string;
  groupCode: string;
}

export interface BuildOptions { view: PlanView; focus: Focus; exploded: boolean; bounds?: GridBounds; islands?: Map<string, number> }

/** Instances des positions des niveaux visibles (zone à libérer permanente exclue : elle est dessinée à part). */
export function buildSeatInstances(floors: readonly FloorPlanData[], opts: BuildOptions): SeatInstance[] {
  const bounds = opts.bounds ?? gridBounds(floors);
  const isl = opts.islands ?? islandNumbers(floors);
  const vis = new Set(visibleFloorCodes(floors, opts.focus));
  const out: SeatInstance[] = [];
  floors.forEach((f, index) => {
    if (!vis.has(f.code)) return;
    const y = floorElevation(index, opts.exploded);
    for (const p of f.positions) {
      if (p.zoneToFree) continue;
      out.push(seatInstance(p, f, y, bounds, isl.get(p.id) ?? null, opts.view));
    }
  });
  return out;
}

function seatInstance(p: PlanPosition, f: FloorPlanData, y: number, b: GridBounds, island: number | null, view: PlanView): SeatInstance {
  const changed = hasChanged(p);
  const fixed = isFixed(p);
  let height = fixed ? FIXED_SEAT_HEIGHT : SEAT_HEIGHT;
  if (view === "changements" && changed) height += CHANGE_LIFT;
  return {
    id: p.id, floor: f.code, floorLabel: f.label, island,
    x: p.c - b.c0 + 0.5, y, z: p.r - b.r0 + 0.5, height,
    shown: shownDirection(p, view), current: p.current, proposed: p.proposed,
    changed, dim: view === "changements" && !changed, fixed, kind: p.kind, groupCode: p.groupCode,
  };
}

/** Texte de détail d'une position survolée. */
export function describeSeat(s: SeatInstance, directions: readonly DirectionStyle[]): string {
  const head = [s.floorLabel, s.island === null ? null : `îlot ${s.island}`, `${s.groupCode === "V" ? "vide" : s.groupCode} (${directionLabel(s.current, directions)})`, `${KIND_LABEL[s.kind] ?? s.kind}${s.fixed ? ", poste fixe" : ""}`]
    .filter(Boolean)
    .join(" · ");
  const tail = s.proposed === null ? "aucune proposition calculée" : s.changed ? `proposition : ${directionLabel(s.proposed, directions)}` : "inchangée";
  return `${head} | ${tail}`;
}

/** Cellules de décor d'un niveau, regroupées par nature. */
export type DecorKind = "wall" | "room" | "office" | "desk" | "training";
export interface DecorCell { x: number; z: number }

export function floorDecor(f: FloorPlanData, bounds: GridBounds): Record<DecorKind, DecorCell[]> {
  const out: Record<DecorKind, DecorCell[]> = { wall: [], room: [], office: [], desk: [], training: [] };
  const at = (r: number, c: number): DecorCell => ({ x: c - bounds.c0, z: r - bounds.r0 });
  for (const cell of f.cells) {
    const kind: DecorKind | null =
      cell.type === "wall" ? "wall"
      : cell.type === "room" || cell.type === "green" ? "room"
      : cell.type === "office" ? "office"
      : cell.type === "desk" || cell.type === "free_m" ? "desk"
      : cell.type === "free" ? "training"
      : null;
    if (kind) out[kind].push(at(cell.r, cell.c));
  }
  for (const p of f.positions) if (p.zoneToFree) out.training.push(at(p.r, p.c));
  return out;
}

/** Comptes par direction, avant (situation) et après (proposition, à défaut la situation). */
export type Counts = Record<string, number>;
export interface CountCell { before: number; after: number }
export interface FloorCountRow { code: string; label: string; cells: Record<string, CountCell>; total: number }
export interface FloorCountTable { columns: string[]; rows: FloorCountRow[]; totals: Record<string, CountCell>; total: number }

/** Colonnes du tableau : directions de l'équation, puis VIDE, puis hors équation (SUPPORT). */
export function countColumns(directions: readonly DirectionStyle[]): string[] {
  return [...directions.filter((d) => d.inEquation).map((d) => d.code), VIDE, ...directions.filter((d) => !d.inEquation).map((d) => d.code)];
}

const add = (m: Record<string, CountCell>, code: string, key: keyof CountCell) => {
  const c = (m[code] ??= { before: 0, after: 0 });
  c[key] += 1;
};

/**
 * Tableau « Positions par niveau et par direction » (avant → après), niveaux du plus haut au plus bas,
 * zone à libérer permanente exclue. Une direction absente des colonnes est ajoutée à la fin.
 */
export function countByFloorAndDirection(floors: readonly FloorPlanData[], directions: readonly DirectionStyle[]): FloorCountTable {
  const columns = countColumns(directions);
  const totals: Record<string, CountCell> = {};
  let total = 0;
  const rows: FloorCountRow[] = floors.map((f) => {
    const cells: Record<string, CountCell> = {};
    let n = 0;
    for (const p of f.positions) {
      if (p.zoneToFree) continue;
      n++;
      add(cells, p.current, "before");
      add(cells, p.proposed ?? p.current, "after");
      add(totals, p.current, "before");
      add(totals, p.proposed ?? p.current, "after");
    }
    total += n;
    return { code: f.code, label: f.label, cells, total: n };
  });
  for (const code of Object.keys(totals)) if (!columns.includes(code)) columns.push(code);
  return { columns, rows: rows.reverse(), totals, total };
}

/** Nombre de positions qui changent de direction (hors libérations vers VIDE), comme /plans et le moteur. */
export function countChanges(floors: readonly FloorPlanData[]): number {
  let n = 0;
  for (const f of floors) for (const p of f.positions) if (!p.zoneToFree && hasChanged(p) && p.proposed !== VIDE) n++;
  return n;
}

/** Open space (îlot) d'un niveau : effectifs par direction avant → après et centre au sol. */
export interface IslandSummary {
  floor: string;
  floorLabel: string;
  island: number;
  size: number;
  before: Counts;
  after: Counts;
  /** Centre au sol en coordonnées monde (x, z). */
  cx: number; cz: number;
}

/** Îlots des niveaux visibles, du plus grand au plus petit (puis niveau, puis numéro). */
export function islandSummaries(floors: readonly FloorPlanData[], focus: Focus, opts: { bounds?: GridBounds; islands?: Map<string, number> } = {}): IslandSummary[] {
  const bounds = opts.bounds ?? gridBounds(floors);
  const isl = opts.islands ?? islandNumbers(floors);
  const vis = new Set(visibleFloorCodes(floors, focus));
  const order = new Map(floors.map((f, i) => [f.code, i]));
  const groups = new Map<string, IslandSummary & { sx: number; sz: number }>();
  for (const f of floors) {
    if (!vis.has(f.code)) continue;
    for (const p of f.positions) {
      if (p.zoneToFree) continue;
      const island = isl.get(p.id);
      if (island === undefined) continue;
      const key = `${f.code}|${island}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { floor: f.code, floorLabel: f.label, island, size: 0, before: {}, after: {}, cx: 0, cz: 0, sx: 0, sz: 0 }));
      g.size++;
      g.before[p.current] = (g.before[p.current] ?? 0) + 1;
      const a = p.proposed ?? p.current;
      g.after[a] = (g.after[a] ?? 0) + 1;
      g.sx += p.c - bounds.c0 + 0.5;
      g.sz += p.r - bounds.r0 + 0.5;
    }
  }
  return [...groups.values()]
    .map(({ sx, sz, ...g }) => ({ ...g, cx: sx / g.size, cz: sz / g.size }))
    .sort((a, b) => b.size - a.size || (order.get(a.floor) ?? 0) - (order.get(b.floor) ?? 0) || a.island - b.island);
}

/** Effectifs affichés d'un îlot selon la vue (situation : avant ; sinon après), du plus grand au plus petit. */
export function islandShownCounts(g: IslandSummary, view: PlanView): { code: string; n: number }[] {
  const counts = view === "situation" ? g.before : g.after;
  return Object.entries(counts).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
}

/** Directions d'un îlot dans la liste (avant ∪ après), triées par effectif après décroissant. */
export function islandRows(g: IslandSummary): { code: string; before: number; after: number }[] {
  const codes = [...new Set([...Object.keys(g.before), ...Object.keys(g.after)])];
  return codes
    .map((code) => ({ code, before: g.before[code] ?? 0, after: g.after[code] ?? 0 }))
    .sort((a, b) => b.after - a.after || b.before - a.before || a.code.localeCompare(b.code));
}

/** Ancre d'étiquette HTML projetée. */
export type LabelAnchor =
  | { kind: "floor"; floor: string; x: number; y: number; z: number; text: string }
  | { kind: "zone"; floor: string; x: number; y: number; z: number; text: string }
  | { kind: "island"; floor: string; x: number; y: number; z: number; size: number; counts: { code: string; n: number }[]; title: string };

/** Ancres : une par niveau visible (« Étage n · N positions »), la salle de formation, une par îlot. */
export function labelAnchors(floors: readonly FloorPlanData[], opts: BuildOptions): LabelAnchor[] {
  const bounds = opts.bounds ?? gridBounds(floors);
  const isl = opts.islands ?? islandNumbers(floors);
  const vis = new Set(visibleFloorCodes(floors, opts.focus));
  const out: LabelAnchor[] = [];
  floors.forEach((f, index) => {
    if (!vis.has(f.code)) return;
    const y0 = floorElevation(index, opts.exploded);
    const total = f.positions.filter((p) => !p.zoneToFree).length;
    out.push({ kind: "floor", floor: f.code, x: -1, y: y0 + 1.2, z: -1, text: `${f.label} · ${total} positions` });
    const zone = f.positions.filter((p) => p.zoneToFree);
    if (zone.length) {
      const x = zone.reduce((a, p) => a + p.c - bounds.c0 + 0.5, 0) / zone.length;
      const z = zone.reduce((a, p) => a + p.r - bounds.r0 + 0.5, 0) / zone.length;
      out.push({ kind: "zone", floor: f.code, x, y: y0 + 0.6, z, text: `Salle de formation · ${zone.length} positions libérées` });
    }
  });
  const yOf = new Map(floors.map((f, i) => [f.code, floorElevation(i, opts.exploded)]));
  for (const g of islandSummaries(floors, opts.focus, { bounds, islands: isl })) {
    out.push({
      kind: "island", floor: g.floor, x: g.cx, y: (yOf.get(g.floor) ?? 0) + 2.2, z: g.cz, size: g.size,
      counts: islandShownCounts(g, opts.view), title: `${g.floorLabel} · îlot ${g.island} · ${g.size} positions`,
    });
  }
  return out;
}

/** Une étiquette s'affiche-t-elle ? Les îlots : niveau isolé ou caméra proche, et au moins 4 positions. */
export function isLabelShown(a: Pick<LabelAnchor, "kind"> & { size?: number }, s: { labels: boolean; focus: Focus; radius: number }): boolean {
  if (!s.labels) return false;
  if (a.kind !== "island") return true;
  const near = s.focus !== ALL_FLOORS || s.radius < ISLAND_LABEL_RADIUS;
  return near && (a.size ?? 0) >= ISLAND_LABEL_MIN_SIZE;
}

/**
 * Projette un point monde à l'écran avec une matrice vue-projection 4×4 en ordre colonne (Matrix4.elements
 * de Three.js : projection × inverse de la caméra). Renvoie la position en pixels et sa visibilité
 * (devant la caméra et dans le cadre, avec une marge de 10 %).
 */
export function projectToScreen(p: { x: number; y: number; z: number }, m: ArrayLike<number>, width: number, height: number): { left: number; top: number; visible: boolean } {
  const cx = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
  const cy = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
  const cz = m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14];
  const cw = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (cw <= 0) return { left: 0, top: 0, visible: false };
  const x = cx / cw, y = cy / cw, z = cz / cw;
  const visible = z <= 1 && x >= -1.1 && x <= 1.1 && y >= -1.1 && y <= 1.1;
  return { left: ((x + 1) / 2) * width, top: ((1 - y) / 2) * height, visible };
}

/** Caméra en orbite : position à partir de la cible, de l'azimut theta, de l'angle polaire phi et du rayon. */
export interface Orbit { theta: number; phi: number; radius: number }
export const DEFAULT_ORBIT: Orbit = { theta: 0.85, phi: 1.0, radius: RADIUS_ALL };
export const PHI_MIN = 0.15;
export const PHI_MAX = 1.45;

export function orbitPosition(target: { x: number; y: number; z: number }, o: Orbit): { x: number; y: number; z: number } {
  return {
    x: target.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
    y: target.y + o.radius * Math.cos(o.phi),
    z: target.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
  };
}

/** Rotation par glissement (pixels) : l'angle polaire reste entre PHI_MIN et PHI_MAX. */
export function rotateOrbit(o: Orbit, dx: number, dy: number): Orbit {
  return { ...o, theta: o.theta - dx * 0.006, phi: Math.min(PHI_MAX, Math.max(PHI_MIN, o.phi - dy * 0.005)) };
}

/** Zoom : facteur multiplicatif borné entre RADIUS_MIN et RADIUS_MAX. */
export function zoomOrbit(o: Orbit, factor: number): Orbit {
  if (!Number.isFinite(factor) || factor <= 0) return o;
  return { ...o, radius: Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, o.radius * factor)) };
}

/** Rapport largeur / hauteur en dessous duquel la caméra recule (écran étroit, mobile). */
export const NARROW_ASPECT = 1;

/**
 * Distance réelle de la caméra : le rayon d'orbite, allongé quand le cadre est plus étroit que NARROW_ASPECT
 * (le champ horizontal rétrécit, le plan serait rogné sur les côtés). Le rayon logique, qui décide de
 * l'affichage des étiquettes d'îlots, ne change pas.
 */
export function cameraDistance(radius: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return radius;
  return radius * Math.max(1, Math.min(2, NARROW_ASPECT / aspect));
}

/**
 * Garde une étiquette entière dans le cadre. L'étiquette est centrée horizontalement sur son ancre et posée
 * au-dessus d'elle (translate(-50 %, -100 %)) : on borne le point d'ancrage pour qu'aucun bord ne déborde.
 */
export function clampLabel(left: number, top: number, labelWidth: number, labelHeight: number, width: number, height: number, margin = 4): { left: number; top: number } {
  const half = labelWidth / 2;
  const minLeft = half + margin, maxLeft = width - half - margin;
  const minTop = labelHeight + margin, maxTop = height - margin;
  return {
    left: minLeft > maxLeft ? width / 2 : Math.min(maxLeft, Math.max(minLeft, left)),
    top: minTop > maxTop ? height : Math.min(maxTop, Math.max(minTop, top)),
  };
}

/** Cible de la caméra : centre du plan, à mi-hauteur des niveaux visibles. */
export function orbitTarget(floors: readonly FloorPlanData[], focus: Focus, exploded: boolean, bounds: GridBounds): { x: number; y: number; z: number } {
  const vis = new Set(visibleFloorCodes(floors, focus));
  const ys = floors.flatMap((f, i) => (vis.has(f.code) ? [floorElevation(i, exploded)] : []));
  const mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  return { x: bounds.nc / 2, y: mid + 1, z: bounds.nr / 2 };
}

/** Nom de la variable CSS de couleur d'une direction (thème clair ou sombre), ex. --c-ammar. */
export function directionCssVar(code: string): string {
  return `--c-${code.toLowerCase()}`;
}

export { SUPPORT, VIDE };
