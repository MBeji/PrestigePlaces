import { describe, expect, it } from "vitest";
import {
  commonRate, countDirectionChanges, deltaOf, deltaTone, floorsChange, formatPercent, groupMovements, maxPresenceRate, parseCount, sharedSeats, signed, targetHeadcount,
} from "./format";

describe("écarts", () => {
  it("signe et tonalité", () => {
    expect(signed(5)).toBe("+5");
    expect(signed(-3)).toBe("−3");
    expect(signed(0)).toBe("0");
    expect(deltaOf(294, 259)).toBe(35);
    expect(deltaTone(35)).toBe("gain");
    expect(deltaTone(-47)).toBe("loss");
    expect(deltaTone(0)).toBe("neutral");
  });
});

describe("taux", () => {
  it("effectif cible", () => expect(targetHeadcount({ cdi: 100, externes: 10, recrutements: 5 })).toBe(115));
  it("postes partagés et taux de présence maximal", () => {
    expect(sharedSeats(204, 14)).toBe(190);
    expect(sharedSeats(5, 14)).toBe(0);
    // quota 204, 14 postes fixes, effectif cible 250 -> 190 / 236
    expect(maxPresenceRate(204, 14, 250)).toBeCloseTo(190 / 236, 6);
    expect(maxPresenceRate(10, 10, 10)).toBeNull();
  });
  it("taux commun", () => {
    expect(commonRate(1031, 1000)).toBeCloseTo(1.031, 6);
    expect(commonRate(10, 0)).toBe(0);
  });
  it("format à la française", () => {
    expect(formatPercent(0.784)).toBe("78,4 %");
    expect(formatPercent(null)).toBe("—");
  });
  it("niveaux avant -> après", () => expect(floorsChange(["2"], ["2", "3"])).toBe("2 → 2, 3"));
});

describe("saisie", () => {
  it("entiers", () => {
    expect(parseCount("12")).toEqual({ ok: true, value: 12 });
    expect(parseCount("-1").ok).toBe(false);
    expect(parseCount("1,5").ok).toBe(false);
    expect(parseCount("").ok).toBe(false);
    expect(parseCount("999999").ok).toBe(false);
  });
});

describe("mouvements", () => {
  const mv = (floor: string, island: number | null, from: string, to: string, r = 1) => ({ positionId: `${floor}${island}${r}${from}`, floor, island, from, to, r, c: 1, kind: "c" });
  it("groupe par niveau et îlot, compte les changements", () => {
    const list = [mv("3", 2, "AMINE", "ZEINEB"), mv("2", 1, "AMMAR", "VIDE"), mv("3", 1, "AMINE", "ZEINEB", 2), mv("3", 1, "AMINE", "ZEINEB", 3)];
    const g = groupMovements(list);
    expect(g.map((x) => x.floor)).toEqual(["2", "3"]);
    expect(g[1].islands.map((i) => i.island)).toEqual([1, 2]);
    expect(g[1].islands[0].flows).toEqual([{ from: "AMINE", to: "ZEINEB", count: 2 }]);
    expect(countDirectionChanges(list)).toBe(3);
  });
});
