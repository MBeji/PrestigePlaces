import { describe, expect, it } from "vitest";
import { buildOverview, formatInt } from "./overview";

const dir = (code: string, cdi: number, externes = 0, recrutements = 0, fixedSeats = 0, current = 0) =>
  ({ code, label: code, color: "#000", cdi, externes, recrutements, fixedSeats, current });

describe("buildOverview", () => {
  it("attribue les positions au prorata de l'effectif cible, même taux pour tous", () => {
    const o = buildOverview({
      directions: [dir("A", 90, 5, 5, 2, 70), dir("B", 200, 0, 0, 3, 130)],
      totalPositions: 260, supportPositions: 20, zonePositions: 30, poolPositions: 210, reservePct: 0,
    });
    expect(o.totals.targetHeadcount).toBe(300);
    expect(o.allocated).toBe(210);
    expect(o.rows.map((r) => r.quota)).toEqual([70, 140]);
    expect(o.totals.quota).toBe(210);
    expect(o.commonRate).toBeCloseTo(0.7, 9);
    for (const r of o.rows) {
      expect(r.seatsPerPerson).toBeCloseTo(0.7, 9);
      expect(r.seatShare).toBeCloseTo(r.headcountShare, 9);
      expect(r.floored).toBe(false);
    }
    expect(o.maxGap).toBeCloseTo(0, 9);
    expect(o.rows.map((r) => r.delta)).toEqual([0, 10]);
  });

  it("déduit la réserve et signale un quota relevé aux postes fixes", () => {
    const o = buildOverview({
      directions: [dir("A", 1000), dir("B", 10, 0, 0, 8)],
      totalPositions: 120, supportPositions: 10, zonePositions: 10, poolPositions: 100, reservePct: 10,
    });
    expect(o.reserve).toBe(10);
    expect(o.allocated).toBe(90);
    const b = o.rows.find((r) => r.code === "B")!;
    expect(b.quota).toBe(8);
    expect(b.floored).toBe(true);
    expect(o.totals.quota).toBe(90);
    expect(o.maxGap).toBeGreaterThan(0.5);
  });

  it("formate les entiers à la française", () => {
    expect(formatInt(1213)).toBe("1 213");
    expect(formatInt(42)).toBe("42");
  });
});
