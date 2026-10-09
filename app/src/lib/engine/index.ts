/**
 * Moteur de dispatching des positions (pur TypeScript, portage de prototype/template.html).
 *
 * API :
 * - `computeQuotas({ directions, positionsToAllocate, reservePct })` → `{ quotas, targetHeadcount,
 *   totalTargetHeadcount, rate, alloc, reserve }` : quota = alloc × effectif cible / Σ effectifs cibles,
 *   plus fort reste, plancher = postes fixes ; `positionsToAllocate` est le pool avant réserve.
 * - `largestRemainder(weights, total)` → entiers de somme `total`.
 * - `islands(seats, maxDist = 2)` → Map seatId → îlot (1..n par niveau, Tchebychev ≤ 2, tri ligne puis colonne).
 * - `minCostFlow(n, s, t, edges)` → `{ flow, cost, used }`.
 * - `solveFloors(ctx, allowed)` → répartition par niveau `{ feasible, cost, release, gain, toReserve }`.
 * - `proposeAllocation(seats, directionParams, { reservePct, floors, extraZoneToFree, maxNewFloorCandidates })`
 *   → `{ quota, current, delta, targetHeadcount, proposed: Map<seatId, direction>, movements:
 *   [{ seatId, floor, island, from, to }], islands, floorPlan, kpis: { positionsToAllocate, reserve,
 *   targetHeadcount, rate, changes, floorsBefore, floorsAfter } }`.
 *   Les positions SUPPORT et les zones à libérer sont hors du pool et ne changent jamais ; les postes
 *   fixes (d, m) et réservés non plus. `movements` inclut les libérations vers VIDE (réserve) ;
 *   `kpis.changes` ne compte que les positions reprises par une autre direction.
 * - `loadSeatsFromSituation(json, { includeZoneToFree })`, `directionParamsFromSituation(json)` :
 *   lecture de data/situation.json.
 * - `seatsFromPositions(positions, assignments)` : adaptateur depuis les lignes Prisma Position + Assignment.
 */
export * from "./types";
export { largestRemainder, computeQuotas } from "./quotas";
export { islands } from "./islands";
export { minCostFlow, type FlowEdge } from "./flow";
export { solveFloors, proposeAllocation, type FloorContext, type FloorSolution } from "./propose";
export {
  loadSeatsFromSituation,
  directionParamsFromSituation,
  seatsFromPositions,
  directionOfGroup,
  type SituationJson,
  type PositionRow,
  type AssignmentRow,
} from "./adapters";
