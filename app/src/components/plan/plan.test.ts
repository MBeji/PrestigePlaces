import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DIRECTIONS, GROUP_DIRECTION } from "@/lib/directions";
import PlanSvg from "./PlanSvg";
import {
  buildPlanModel, mergeFloorPlans, nextSeat, seatDetails, summarizeFloor,
  type DirectionStyle, type FloorPlanData, type FloorPlanInput,
} from "./model";

const directions: DirectionStyle[] = DIRECTIONS.map((d) => ({ ...d }));

/** Petit niveau : un mur, une salle, un directeur Ammar, deux postes Zeineb, un Support, un vide, une zone à libérer. */
function smallInput(): { situation: FloorPlanInput; proposal: FloorPlanInput } {
  const pos = (id: string, r: number, c: number, kind: string, groupCode: string, directionCode: string, zoneToFree = false) => ({
    id, r, c, kind, type: "POSTE", groupCode, zoneToFree, islandIndex: zoneToFree ? 1 : 0, directionCode,
  });
  const positions = [
    pos("p1", 10, 20, "d", "BLI", "AMMAR"),
    pos("p2", 10, 21, "c", "Z", "ZEINEB"),
    pos("p3", 10, 22, "c", "Z", "ZEINEB"),
    pos("p4", 11, 20, "c", "SUP", "SUPPORT"),
    pos("p5", 11, 21, "c", "V", "VIDE"),
    pos("p6", 12, 30, "c", "FORMATION", "ZONE_A_LIBERER", true),
  ];
  const cells = [{ r: 9, c: 19, type: "wall" }, { r: 13, c: 31, type: "room" }, { r: 13, c: 32, type: "desk" }];
  const situation = { floor: { code: "RDC", label: "RDC" }, cells, positions };
  const proposal = {
    floor: situation.floor, cells,
    positions: positions.map((p) => (p.id === "p3" ? { ...p, directionCode: "AMMAR" } : p.id === "p5" ? { ...p, directionCode: "ZEINEB" } : p)),
  };
  return { situation, proposal };
}

describe("modèle des plans", () => {
  it("fusionne situation et proposition, et repère les changements", () => {
    const { situation, proposal } = smallInput();
    const data = mergeFloorPlans(situation, proposal, ["p2"]);
    expect(data.positions.find((p) => p.id === "p3")).toMatchObject({ current: "ZEINEB", proposed: "AMMAR" });
    expect(data.positions.find((p) => p.id === "p2")?.extraZone).toBe(true);

    const model = buildPlanModel(data, "changements", directions);
    expect(model.width).toBe(14 * 14); // colonnes 19 à 32
    expect(model.height).toBe(5 * 14); // lignes 9 à 13
    expect(model.seats).toHaveLength(5); // la zone à libérer n'est pas une position affectable
    expect(model.cells.filter((c) => c.kind === "training")).toHaveLength(1);
    expect(model.zone?.count).toBe(1);
    expect(model.changes).toBe(2);
    const p1 = model.seats.find((s) => s.id === "p1")!;
    expect(p1).toMatchObject({ mark: "D", outline: "fixed", dim: true, fill: "#2a78d6" });
    expect(model.seats.find((s) => s.id === "p3")).toMatchObject({ outline: "changed", dim: false, shown: "AMMAR" });
    expect(model.seats.find((s) => s.id === "p4")?.pattern).toBe("support");

    const situationModel = buildPlanModel(data, "situation", directions);
    expect(situationModel.seats.find((s) => s.id === "p3")).toMatchObject({ outline: null, shown: "ZEINEB" });
    expect(situationModel.seats.find((s) => s.id === "p5")?.fill).toBe("var(--c-vide)");
  });

  it("résume le niveau avant → après et décrit une position", () => {
    const { situation, proposal } = smallInput();
    const data = mergeFloorPlans(situation, proposal);
    const sum = Object.fromEntries(summarizeFloor(data, directions).map((r) => [r.code, [r.before, r.after]]));
    expect(sum).toEqual({ AMMAR: [1, 2], ZEINEB: [2, 2], VIDE: [1, 0], SUPPORT: [1, 1] });
    const details = Object.fromEntries(seatDetails(data.positions[2], "RDC", directions).map((d) => [d.term, d.value]));
    expect(details).toMatchObject({ Niveau: "RDC", Ligne: "10", Colonne: "22", Îlot: "1", Groupe: "Z", Direction: "Zeineb", Catégorie: "collaborateur" });
    expect(details.Proposition).toBe("Ammar (au lieu de Zeineb)");
  });

  it("navigue au clavier vers la position voisine", () => {
    const seats = [{ id: "a", r: 1, c: 1 }, { id: "b", r: 1, c: 2 }, { id: "c", r: 2, c: 1 }, { id: "d", r: 5, c: 9 }];
    expect(nextSeat(seats, "a", "ArrowRight")?.id).toBe("b");
    expect(nextSeat(seats, "a", "ArrowDown")?.id).toBe("c");
    expect(nextSeat(seats, "a", "ArrowLeft")).toBeNull();
    expect(nextSeat(seats, null, "End")?.id).toBe("d");
  });

  it("dessine le RDC réel avec la zone à libérer de 39 positions", () => {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../data/situation.json", import.meta.url)), "utf8")) as {
      floors: Record<string, { label: string; cells: { r: number; c: number; t: string; g?: string; k?: string }[] }>;
    };
    const f = raw.floors.RDC;
    const zoneM = f.cells.filter((x) => x.t === "free_m" && x.r === 20).sort((a, b) => a.c - b.c)[0];
    const isZone = (x: { r: number; c: number; t: string }) => x.t === "free" || x === zoneM;
    const data: FloorPlanData = {
      code: "RDC", label: f.label,
      cells: f.cells.filter((x) => x.t !== "seat" && !isZone(x) && x.t !== "legend").map((x) => ({ r: x.r, c: x.c, type: x.t === "free_m" ? "desk" : x.t })),
      positions: f.cells.filter((x) => x.t === "seat" || isZone(x)).map((x, i) => ({
        id: `s${i}`, r: x.r, c: x.c, kind: x.k ?? "c", groupCode: x.g ?? "V", islandIndex: null, zoneToFree: isZone(x), extraZone: false,
        current: isZone(x) ? "ZONE_A_LIBERER" : (GROUP_DIRECTION[x.g ?? "V"] ?? "VIDE"), proposed: null,
      })),
    };
    const model = buildPlanModel(data, "situation", directions);
    expect(model.zone?.count).toBe(39);
    expect(model.width).toBe(44 * 14);
    expect(model.height).toBe(39 * 14);

    const html = renderToStaticMarkup(createElement(PlanSvg, { data, view: "situation", directions }));
    expect(html).toContain("Salle de formation");
    expect(html).toContain("39 positions libérées (ex-BLI)");
    expect(html).toContain('aria-label="Plan du niveau RDC, vue Situation"');
    expect((html.match(/role="button"/g) ?? []).length).toBe(model.seats.length);
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1); // tabindex itinérant
    expect(html).toContain("Support (hors équation)");
    expect(html).not.toContain("contour épais");
  });

  it("rend les vues proposition et changements avec le résumé avant → après", () => {
    const { situation, proposal } = smallInput();
    const data = mergeFloorPlans(situation, proposal);
    const html = renderToStaticMarkup(createElement(PlanSvg, { data, view: "proposition", directions }));
    expect(html).toContain("contour épais : position qui change");
    expect((html.match(/data-changed="true"/g) ?? []).length).toBe(2);
    expect(html).toMatch(/Ammar <span>1 <span[^>]*>→<\/span> <b[^>]*>2<\/b>/);
    expect(html).toContain(">D</text>");
    const changes = renderToStaticMarkup(createElement(PlanSvg, { data, view: "changements", directions }));
    expect((changes.match(/opacity="0.25"/g) ?? []).length).toBe(3);
  });
});
