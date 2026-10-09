import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeQuotas,
  directionParamsFromSituation,
  islands,
  largestRemainder,
  loadSeatsFromSituation,
  minCostFlow,
  proposeAllocation,
  seatsFromPositions,
  SUPPORT,
  VIDE,
  type SituationJson,
} from "../../src/lib/engine";

const json = JSON.parse(readFileSync(fileURLToPath(new URL("../../../data/situation.json", import.meta.url)), "utf8")) as SituationJson;
const seats = loadSeatsFromSituation(json);
const params = directionParamsFromSituation(json);

describe("largestRemainder", () => {
  it("conserve le total et départage au plus fort reste", () => {
    expect(largestRemainder([1, 1, 1], 10)).toEqual([4, 3, 3]);
    expect(largestRemainder([0, 0], 5)).toEqual([0, 0]);
    expect(largestRemainder([3, 2, 5], 7).reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe("computeQuotas", () => {
  it("applique le plancher des postes fixes et la réserve", () => {
    const r = computeQuotas({
      directions: [
        { code: "A", cdi: 90, externes: 0, recrutements: 0, fixedSeats: 1 },
        { code: "B", cdi: 1, externes: 0, recrutements: 0, fixedSeats: 5 },
      ],
      positionsToAllocate: 100,
      reservePct: 10,
    });
    expect(r.reserve).toBe(10);
    expect(r.alloc).toBe(90);
    expect(r.quotas.B).toBe(5);
    // Le plancher est pris sur les autres directions : la réserve reste intacte.
    expect(r.quotas.A).toBe(85);
    expect(r.quotas.A + r.quotas.B).toBe(r.alloc);
    expect(r.targetHeadcount).toEqual({ A: 90, B: 1 });
  });
});

describe("minCostFlow", () => {
  it("préfère le chemin le moins cher", () => {
    const r = minCostFlow(4, 0, 3, [
      { u: 0, v: 1, cap: 2, cost: 1 },
      { u: 0, v: 2, cap: 2, cost: 5 },
      { u: 1, v: 3, cap: 2, cost: 0 },
      { u: 2, v: 3, cap: 2, cost: 0 },
    ]);
    expect(r.flow).toBe(4);
    expect(r.cost).toBe(12);
    expect(r.used).toEqual([2, 2, 2, 2]);
  });
});

describe("islands", () => {
  it("regroupe à distance de Tchebychev ≤ 2 et numérote par ligne puis colonne", () => {
    const m = islands([
      { id: "a", floor: "1", r: 10, c: 1 },
      { id: "b", floor: "1", r: 12, c: 3 },
      { id: "c", floor: "1", r: 1, c: 20 },
      { id: "d", floor: "2", r: 1, c: 1 },
    ]);
    expect(m.get("c")).toBe(1);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(2);
    expect(m.get("d")).toBe(1);
  });
});

describe("données de situation.json", () => {
  it("lit 1153 positions et 39 positions à libérer", () => {
    expect(seats.filter((s) => !s.zoneToFree)).toHaveLength(1153);
    expect(seats.filter((s) => s.zoneToFree)).toHaveLength(39);
    expect(seats.filter((s) => s.direction === SUPPORT)).toHaveLength(106);
  });
});

describe("proposeAllocation sur situation.json", () => {
  const r = proposeAllocation(seats, params);

  it("calcule les quotas attendus", () => {
    expect(r.quota).toEqual({ AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217 });
    const sum = Object.values(r.quota).reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.kpis.positionsToAllocate);
    expect(r.kpis.positionsToAllocate).toBe(1047);
    expect(r.kpis.reserve).toBe(0);
    expect(r.kpis.targetHeadcount).toBe(1334);
    expect(r.kpis.rate).toBeCloseTo(1047 / 1334, 10);
  });

  it("change 69 positions de direction", () => {
    expect(r.kpis.changes).toBe(69);
    expect(r.movements.filter((m) => m.to !== VIDE)).toHaveLength(69);
  });

  it("atteint exactement les quotas", () => {
    const after: Record<string, number> = {};
    for (const s of seats) {
      const d = r.proposed.get(s.id)!;
      after[d] = (after[d] ?? 0) + 1;
    }
    for (const [d, q] of Object.entries(r.quota)) expect(after[d]).toBe(q);
  });

  it("respecte les niveaux avant et après", () => {
    expect(r.kpis.floorsBefore.ZEINEB).toEqual(["2"]);
    expect(r.kpis.floorsAfter.ZEINEB).toEqual(["2", "3"]);
    expect(r.kpis.floorsBefore.BEJI).toEqual(["RDC", "4"]);
    expect(r.kpis.floorsAfter.BEJI).toEqual(["RDC", "4"]);
    expect(r.kpis.floorsAfter.BOUBAKER).toEqual(["1"]);
    expect(r.kpis.floorsAfter.AMMAR).toEqual(["RDC", "1", "3"]);
    expect(r.kpis.floorsAfter.AMINE).toEqual(["3", "4"]);
  });

  it("ne touche ni au support, ni aux zones à libérer, ni aux postes fixes occupés", () => {
    for (const s of seats) {
      if (s.direction === SUPPORT || s.zoneToFree || (s.fixed && s.direction !== VIDE)) expect(r.proposed.get(s.id)).toBe(s.direction);
    }
    expect(r.movements.every((m) => !m.seatId.startsWith("RDC:") || !seats.find((s) => s.id === m.seatId)!.zoneToFree)).toBe(true);
  });

  it("numérote les îlots des mouvements", () => {
    expect(r.movements.every((m) => m.island >= 1)).toBe(true);
  });

  it("calcule en moins d'une seconde", () => {
    const t0 = performance.now();
    proposeAllocation(seats, params);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe("proposeAllocation avec réserve de 5 %", () => {
  const r = proposeAllocation(seats, params, { reservePct: 5 });
  it("répartit alloc et laisse la réserve libre", () => {
    expect(r.kpis.reserve).toBe(Math.round((1047 * 5) / 100));
    const sum = Object.values(r.quota).reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.kpis.positionsToAllocate);
    expect(r.kpis.positionsToAllocate + r.kpis.reserve).toBe(1047);
    const pool = seats.filter((s) => !s.zoneToFree && s.direction !== SUPPORT);
    const free = pool.filter((s) => r.proposed.get(s.id) === VIDE).length;
    expect(free).toBe(r.kpis.reserve);
    for (const s of seats) if (s.direction === SUPPORT || s.zoneToFree || (s.fixed && s.direction !== VIDE)) expect(r.proposed.get(s.id)).toBe(s.direction);
  });
});

describe("seatsFromPositions", () => {
  it("reconstruit les mêmes résultats depuis des lignes Prisma", () => {
    const positions = seats.map((s) => ({ id: s.id, r: s.r, c: s.c, kind: s.kind, groupCode: s.groupCode, zoneToFree: s.zoneToFree, reserved: false, floor: { code: s.floor } }));
    const assignments = seats.filter((s) => s.direction !== VIDE).map((s) => ({ positionId: s.id, directionCode: s.direction }));
    const fromDb = seatsFromPositions([...positions].reverse(), assignments);
    expect(fromDb.filter((s) => s.direction === VIDE && !s.zoneToFree)).toHaveLength(16);
    const r = proposeAllocation(fromDb, params);
    expect(r.kpis.changes).toBe(69);
    const ref = proposeAllocation(seats, params);
    for (const s of seats) expect(r.proposed.get(s.id)).toBe(ref.proposed.get(s.id));
  });

  it("ne déplace pas un poste réservé", () => {
    const base = seatsFromPositions(
      seats.map((s) => ({ id: s.id, r: s.r, c: s.c, kind: s.kind, groupCode: s.groupCode, zoneToFree: s.zoneToFree, floorCode: s.floor })),
      seats.filter((s) => s.direction !== VIDE).map((s) => ({ positionId: s.id, directionCode: s.direction })),
    );
    const ref = proposeAllocation(base, params);
    const moved = ref.movements.find((m) => m.from !== VIDE)!;
    const withReserved = base.map((s) => (s.id === moved.seatId ? { ...s, reserved: true } : s));
    const r = proposeAllocation(withReserved, params);
    expect(r.proposed.get(moved.seatId)).toBe(moved.from);
  });
});
