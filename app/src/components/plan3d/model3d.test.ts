import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DIRECTIONS } from "@/lib/directions";
import { directionParamsFromSituation, loadSeatsFromSituation, proposeAllocation, type SituationJson } from "@/lib/engine";
import type { DirectionStyle, FloorPlanData } from "@/components/plan/model";
import {
  ALL_FLOORS, buildSeatInstances, cameraDistance, clampLabel, countByFloorAndDirection, countChanges, describeSeat, floorDecor, floorElevation, gridBounds,
  isLabelShown, islandNumbers, islandRows, islandShownCounts, islandSummaries, labelAnchors, orbitPosition, orbitTarget,
  projectToScreen, rotateOrbit, zoomOrbit, DEFAULT_ORBIT, PHI_MAX, RADIUS_MIN,
} from "./model3d";

const directions: DirectionStyle[] = DIRECTIONS.map((d) => ({ ...d }));
const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../data/situation.json", import.meta.url)), "utf8")) as SituationJson;

/** Plans des 5 niveaux du scénario de référence, situation + proposition du moteur (comme getFloorPlan + mergeFloorPlans). */
function referenceFloors(): FloorPlanData[] {
  const seats = loadSeatsFromSituation(json);
  const result = proposeAllocation(seats, directionParamsFromSituation(json), { reservePct: 0 });
  return ["RDC", "1", "2", "3", "4"].map((code) => {
    const f = json.floors[code];
    const mine = seats.filter((s) => s.floor === code);
    const taken = new Set(mine.map((s) => `${s.r}:${s.c}`));
    return {
      code,
      label: f.label ?? code,
      cells: f.cells
        .filter((x) => x.t !== "seat" && x.t !== "legend" && !taken.has(`${x.r}:${x.c}`))
        .map((x) => ({ r: x.r, c: x.c, type: x.t === "free_m" ? "desk" : x.t === "red" ? "wall" : x.t })),
      positions: mine.map((s) => ({
        id: s.id, r: s.r, c: s.c, kind: s.kind, groupCode: s.groupCode, islandIndex: null, zoneToFree: s.zoneToFree, extraZone: false,
        current: s.zoneToFree ? "ZONE_A_LIBERER" : s.direction,
        proposed: s.zoneToFree ? "ZONE_A_LIBERER" : (result.proposed.get(s.id) ?? s.direction),
      })),
    };
  });
}

const floors = referenceFloors();

describe("vue 3D : comptes du scénario de référence", () => {
  const table = countByFloorAndDirection(floors, directions);

  it("compte les positions par direction avant → après (quotas de référence)", () => {
    const t = (code: string) => [table.totals[code]?.before ?? 0, table.totals[code]?.after ?? 0];
    expect(t("AMMAR")).toEqual([251, 204]);
    expect(t("ZEINEB")).toEqual([259, 294]);
    expect(t("BOUBAKER")[1]).toBe(137);
    expect(t("AMINE")[1]).toBe(195);
    expect(t("BEJI")[1]).toBe(217);
    expect(t("SUPPORT")[0]).toBe(t("SUPPORT")[1]); // les fonctions support ne bougent jamais
    expect(table.total).toBe(1153);
    const sumBefore = table.columns.reduce((a, c) => a + (table.totals[c]?.before ?? 0), 0);
    const sumAfter = table.columns.reduce((a, c) => a + (table.totals[c]?.after ?? 0), 0);
    expect(sumBefore).toBe(table.total);
    expect(sumAfter).toBe(table.total);
  });

  it("présente les niveaux du plus haut au plus bas, colonnes directions puis vide puis support", () => {
    expect(table.rows.map((r) => r.code)).toEqual(["4", "3", "2", "1", "RDC"]);
    expect(table.columns).toEqual(["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI", "VIDE", "SUPPORT"]);
    for (const row of table.rows) {
      const before = Object.values(row.cells).reduce((a, c) => a + c.before, 0);
      const after = Object.values(row.cells).reduce((a, c) => a + c.after, 0);
      expect(before).toBe(row.total);
      expect(after).toBe(row.total);
    }
    // la somme des niveaux redonne les totaux par direction
    for (const code of table.columns) {
      const before = table.rows.reduce((a, r) => a + (r.cells[code]?.before ?? 0), 0);
      expect(before).toBe(table.totals[code]?.before ?? 0);
    }
  });

  it("compte 69 positions qui changent de direction", () => {
    expect(countChanges(floors)).toBe(69);
  });
});

describe("vue 3D : instances des positions", () => {
  const bounds = gridBounds(floors);

  it("cale la grille commune des niveaux sur celle du prototype", () => {
    expect(bounds).toEqual({ r0: 5, c0: 15, nr: 39, nc: 44 });
  });

  it("empile les niveaux en vue éclatée (écart 13) ou compacte (2,6)", () => {
    expect(floorElevation(4, true)).toBe(52);
    expect(floorElevation(4, false)).toBeCloseTo(10.4);
    const all = buildSeatInstances(floors, { view: "situation", focus: ALL_FLOORS, exploded: true, bounds });
    expect(all).toHaveLength(1153);
    expect(new Set(all.filter((s) => s.floor === "3").map((s) => s.y))).toEqual(new Set([39]));
    const one = buildSeatInstances(floors, { view: "situation", focus: "2", exploded: false, bounds });
    expect(one.every((s) => s.floor === "2" && s.y === floorElevation(2, false))).toBe(true);
  });

  it("surélève les postes fixes, puis les changements en vue changements, et atténue le reste", () => {
    const sit = buildSeatInstances(floors, { view: "situation", focus: ALL_FLOORS, exploded: true, bounds });
    const fixed = sit.filter((s) => s.fixed);
    expect(fixed.length).toBeGreaterThan(0);
    expect(fixed.every((s) => s.height === 1.9)).toBe(true);
    expect(sit.filter((s) => !s.fixed).every((s) => s.height === 1)).toBe(true);
    expect(sit.some((s) => s.dim)).toBe(false);

    const chg = buildSeatInstances(floors, { view: "changements", focus: ALL_FLOORS, exploded: true, bounds });
    const changed = chg.filter((s) => s.changed);
    expect(changed.length).toBeGreaterThanOrEqual(69); // 69 changements + libérations vers VIDE
    // un poste fixe vide (manager sans titulaire) peut être attribué : il garde sa hauteur de poste fixe + 0,9
    expect(changed.every((s) => s.height === (s.fixed ? 1.9 : 1) + 0.9)).toBe(true);
    expect(changed.filter((s) => s.fixed).every((s) => s.current === "VIDE")).toBe(true);
    expect(chg.filter((s) => !s.changed).every((s) => s.dim)).toBe(true);
    expect(changed.every((s) => s.shown === s.proposed)).toBe(true);

    const s = sit.find((x) => x.changed)!;
    expect(s.shown).toBe(s.current);
    expect(describeSeat(s, directions)).toMatch(/^(RDC|Étage \d) · îlot \d+ · .+ \| proposition : /);
  });

  it("place la zone à libérer du RDC en décor translucide et étiquette « Salle de formation »", () => {
    const decor = floorDecor(floors[0], bounds);
    expect(decor.training).toHaveLength(39);
    expect(decor.wall.length).toBeGreaterThan(0);
    const anchors = labelAnchors(floors, { view: "situation", focus: ALL_FLOORS, exploded: true, bounds });
    const zone = anchors.filter((a) => a.kind === "zone");
    expect(zone).toHaveLength(1);
    expect(zone[0]).toMatchObject({ floor: "RDC", text: "Salle de formation · 39 positions libérées" });
    const floorLabels = anchors.filter((a) => a.kind === "floor").map((a) => (a.kind === "floor" ? a.text : ""));
    expect(floorLabels).toHaveLength(5);
    expect(floorLabels[0]).toMatch(/^RDC · \d+ positions$/);
    expect(floorLabels[1]).toMatch(/^Étage 1 · \d+ positions$/);
    const totalOnLabels = floorLabels.reduce((a, t) => a + Number(/· (\d+) positions/.exec(t)![1]), 0);
    expect(totalOnLabels).toBe(1153);
  });
});

describe("vue 3D : open spaces", () => {
  const isl = islandNumbers(floors);

  it("numérote les îlots de 1 à n par niveau et conserve les effectifs", () => {
    const sums = islandSummaries(floors, ALL_FLOORS, { islands: isl });
    expect(sums.reduce((a, g) => a + g.size, 0)).toBe(1153);
    for (const g of sums) {
      expect(g.island).toBeGreaterThanOrEqual(1);
      expect(Object.values(g.before).reduce((a, n) => a + n, 0)).toBe(g.size);
      expect(Object.values(g.after).reduce((a, n) => a + n, 0)).toBe(g.size);
    }
    for (let i = 1; i < sums.length; i++) expect(sums[i - 1].size).toBeGreaterThanOrEqual(sums[i].size);
    // Somme des effectifs après sur les îlots = totaux par direction
    const ammarAfter = sums.reduce((a, g) => a + (g.after.AMMAR ?? 0), 0);
    expect(ammarAfter).toBe(204);
  });

  it("filtre par niveau isolé et trie les directions d'un îlot", () => {
    const rdc = islandSummaries(floors, "RDC", { islands: isl });
    expect(rdc.every((g) => g.floor === "RDC")).toBe(true);
    const g = rdc[0];
    const rows = islandRows(g);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].after).toBeGreaterThanOrEqual(rows[i].after);
    expect(islandShownCounts(g, "situation").reduce((a, x) => a + x.n, 0)).toBe(g.size);
  });

  it("n'affiche les étiquettes d'îlots que sur un niveau isolé ou de près, et pour 4 positions au moins", () => {
    expect(isLabelShown({ kind: "floor" }, { labels: true, focus: ALL_FLOORS, radius: 110 })).toBe(true);
    expect(isLabelShown({ kind: "floor" }, { labels: false, focus: ALL_FLOORS, radius: 110 })).toBe(false);
    expect(isLabelShown({ kind: "island", size: 10 }, { labels: true, focus: ALL_FLOORS, radius: 110 })).toBe(false);
    expect(isLabelShown({ kind: "island", size: 10 }, { labels: true, focus: ALL_FLOORS, radius: 80 })).toBe(true);
    expect(isLabelShown({ kind: "island", size: 10 }, { labels: true, focus: "2", radius: 110 })).toBe(true);
    expect(isLabelShown({ kind: "island", size: 3 }, { labels: true, focus: "2", radius: 60 })).toBe(false);
  });
});

describe("vue 3D : caméra et projection", () => {
  it("projette un point avec une matrice vue-projection en ordre colonne", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(projectToScreen({ x: 0, y: 0, z: 0 }, identity, 800, 600)).toEqual({ left: 400, top: 300, visible: true });
    expect(projectToScreen({ x: 1, y: 1, z: 0 }, identity, 800, 600)).toEqual({ left: 800, top: 0, visible: true });
    expect(projectToScreen({ x: 2, y: 0, z: 0 }, identity, 800, 600).visible).toBe(false);
    // perspective simple : w = -z (caméra regardant vers -z) ; un point derrière la caméra est masqué
    const persp = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0];
    expect(projectToScreen({ x: 1, y: 0, z: -2 }, persp, 100, 100)).toEqual({ left: 75, top: 50, visible: true });
    expect(projectToScreen({ x: 0, y: 0, z: 2 }, persp, 100, 100).visible).toBe(false);
  });

  it("tourne et zoome dans les bornes", () => {
    const o = rotateOrbit(DEFAULT_ORBIT, 0, -10_000);
    expect(o.phi).toBe(PHI_MAX);
    expect(zoomOrbit(DEFAULT_ORBIT, 0.0001).radius).toBe(RADIUS_MIN);
    expect(zoomOrbit(DEFAULT_ORBIT, Number.NaN)).toBe(DEFAULT_ORBIT);
    const p = orbitPosition({ x: 0, y: 0, z: 0 }, { theta: 0, phi: Math.PI / 2, radius: 10 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(10);
  });

  it("recule la caméra sur un cadre étroit, sans toucher au rayon logique", () => {
    expect(cameraDistance(110, 1.6)).toBe(110);
    expect(cameraDistance(110, 1)).toBe(110);
    expect(cameraDistance(110, 0.8)).toBeCloseTo(137.5);
    expect(cameraDistance(110, 0.5)).toBeCloseTo(220);
    expect(cameraDistance(110, 0.2)).toBe(220); // plafonné à ×2
    expect(cameraDistance(110, Number.NaN)).toBe(110);
  });

  it("garde les étiquettes entières dans le cadre", () => {
    // étiquette de 120 × 20 posée au-dessus de son ancre, centrée horizontalement
    expect(clampLabel(400, 300, 120, 20, 800, 600)).toEqual({ left: 400, top: 300 });
    expect(clampLabel(400, 5, 120, 20, 800, 600)).toEqual({ left: 400, top: 24 });
    expect(clampLabel(10, 300, 120, 20, 800, 600)).toEqual({ left: 64, top: 300 });
    expect(clampLabel(795, 900, 120, 20, 800, 600)).toEqual({ left: 736, top: 596 });
    expect(clampLabel(10, 300, 400, 20, 300, 600).left).toBe(150); // plus large que le cadre : centrée
  });

  it("vise le centre du plan à mi-hauteur des niveaux visibles", () => {
    const b = gridBounds(floors);
    expect(orbitTarget(floors, ALL_FLOORS, true, b)).toEqual({ x: 22, y: 27, z: 19.5 });
    expect(orbitTarget(floors, "RDC", true, b)).toEqual({ x: 22, y: 1, z: 19.5 });
  });
});
