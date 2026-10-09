import { computeIslands } from "../islands";
import type { Seat } from "./types";

/**
 * Îlots : composantes connexes de positions à distance de Tchebychev ≤ maxDist, calculées par niveau.
 * Numérotation 1..n par niveau, triée par ligne minimale puis colonne minimale (comme le prototype).
 * Retourne une Map seatId → numéro d'îlot.
 */
export function islands(seats: readonly Pick<Seat, "id" | "floor" | "r" | "c">[], maxDist = 2): Map<string, number> {
  const byFloor = new Map<string, Pick<Seat, "id" | "floor" | "r" | "c">[]>();
  for (const s of seats) {
    const arr = byFloor.get(s.floor);
    if (arr) arr.push(s);
    else byFloor.set(s.floor, [s]);
  }
  const out = new Map<string, number>();
  for (const arr of byFloor.values()) {
    const comp = computeIslands(arr, maxDist);
    const bounds = new Map<number, { r: number; c: number; members: string[] }>();
    arr.forEach((s, i) => {
      const b = bounds.get(comp[i]);
      if (!b) bounds.set(comp[i], { r: s.r, c: s.c, members: [s.id] });
      else {
        b.r = Math.min(b.r, s.r);
        b.c = Math.min(b.c, s.c);
        b.members.push(s.id);
      }
    });
    [...bounds.values()]
      .sort((a, b) => a.r - b.r || a.c - b.c)
      .forEach((b, i) => b.members.forEach((id) => out.set(id, i + 1)));
  }
  return out;
}
