/** Arc d'un réseau de flot. */
export interface FlowEdge {
  u: number;
  v: number;
  cap: number;
  cost: number;
}

/**
 * Flot maximal à coût minimal (plus courts chemins successifs, Bellman-Ford en file / SPFA).
 * `n` nœuds numérotés 0..n-1, source `s`, puits `t`. Retourne le flot total, son coût
 * et le flot passé sur chaque arc d'entrée (même ordre que `edges`).
 */
export function minCostFlow(n: number, s: number, t: number, edges: readonly FlowEdge[]): { flow: number; cost: number; used: number[] } {
  interface Arc { v: number; cap: number; cost: number; rev: number; cap0: number }
  const g: Arc[][] = Array.from({ length: n }, () => []);
  const refs: Arc[] = [];
  for (const e of edges) {
    const fwd: Arc = { v: e.v, cap: e.cap, cost: e.cost, rev: g[e.v].length, cap0: e.cap };
    const bwd: Arc = { v: e.u, cap: 0, cost: -e.cost, rev: g[e.u].length, cap0: 0 };
    g[e.u].push(fwd);
    g[e.v].push(bwd);
    refs.push(fwd);
  }
  let flow = 0;
  for (;;) {
    const dist = new Array<number>(n).fill(Infinity);
    const inq = new Array<boolean>(n).fill(false);
    const pn = new Array<number>(n).fill(-1);
    const pe = new Array<number>(n).fill(-1);
    dist[s] = 0;
    const q = [s];
    inq[s] = true;
    let head = 0;
    while (head < q.length) {
      const u = q[head++];
      inq[u] = false;
      g[u].forEach((e, i) => {
        if (e.cap > 0 && dist[u] + e.cost < dist[e.v]) {
          dist[e.v] = dist[u] + e.cost;
          pn[e.v] = u;
          pe[e.v] = i;
          if (!inq[e.v]) {
            inq[e.v] = true;
            q.push(e.v);
          }
        }
      });
    }
    if (dist[t] === Infinity) break;
    let f = Infinity;
    for (let v = t; v !== s; v = pn[v]) f = Math.min(f, g[pn[v]][pe[v]].cap);
    for (let v = t; v !== s; v = pn[v]) {
      const e = g[pn[v]][pe[v]];
      e.cap -= f;
      g[v][e.rev].cap += f;
    }
    flow += f;
  }
  const used = refs.map((e) => e.cap0 - e.cap);
  const cost = used.reduce((a, x, i) => a + x * edges[i].cost, 0);
  return { flow, cost, used };
}
