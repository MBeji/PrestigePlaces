import { describe, expect, it } from "vitest";
import { computeIslands } from "./islands";

describe("computeIslands", () => {
  it("regroupe les cellules proches et sépare les autres", () => {
    const ids = computeIslands([
      { r: 0, c: 0 },
      { r: 1, c: 2 },
      { r: 0, c: 10 },
      { r: 2, c: 4 },
    ]);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[3]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
  });
});
