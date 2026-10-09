/** Composantes connexes de cellules à distance de Tchebychev <= maxDist. Retourne l'index d'îlot (0..n-1) par cellule. */
export function computeIslands(cells: { r: number; c: number }[], maxDist = 2): number[] {
  const parent = cells.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const byKey = new Map<string, number[]>();
  const key = (r: number, c: number) => `${r}:${c}`;
  cells.forEach((p, i) => {
    const k = key(Math.floor(p.r / 4), Math.floor(p.c / 4));
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(i);
  });
  cells.forEach((p, i) => {
    const br = Math.floor(p.r / 4);
    const bc = Math.floor(p.c / 4);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        for (const j of byKey.get(key(br + dr, bc + dc)) ?? []) {
          if (j <= i) continue;
          if (Math.max(Math.abs(cells[j].r - p.r), Math.abs(cells[j].c - p.c)) <= maxDist) parent[find(j)] = find(i);
        }
  });
  const ids = new Map<number, number>();
  return cells.map((_, i) => {
    const root = find(i);
    if (!ids.has(root)) ids.set(root, ids.size);
    return ids.get(root)!;
  });
}
