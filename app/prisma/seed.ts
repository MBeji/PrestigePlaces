import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type PlanCellType, type PositionKind } from "@prisma/client";
import { DIRECTIONS, EMPTY_GROUP, FORMATION_GROUP, GROUP_DIRECTION } from "../src/lib/directions";
import { computeIslands } from "../src/lib/islands";

const prisma = new PrismaClient();
const SCENARIO_NAME = "Situation 7 (classeur)";
const SITE_CODE = "TUNIS";

type Cell = { r: number; c: number; t: string; g?: string; k?: PositionKind };
type Situation = {
  groups: Record<string, { label: string; direction: string; cdi: { d: number; m: number; c: number }; recrutements: number; externes: number }>;
  floors: Record<string, { label: string; cells: Cell[] }>;
};

const FLOOR_ORDER = ["RDC", "1", "2", "3", "4"];
const PLAN_TYPES = new Set(["wall", "office", "room", "green", "free", "free_m"]);
const chunk = <T>(a: T[], n = 500): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
const typeOf = (k: PositionKind) => (k === "d" ? "BUREAU_DIRECTEUR" : k === "m" ? "POSTE_MANAGER" : "POSTE") as
  | "BUREAU_DIRECTEUR"
  | "POSTE_MANAGER"
  | "POSTE";

async function main() {
  const data: Situation = JSON.parse(readFileSync(resolve(__dirname, "../../data/situation.json"), "utf8"));

  // Purge contrôlée : le site Tunis (cascade sur niveaux, plans, positions, affectations) et le scénario de référence.
  await prisma.scenario.deleteMany({ where: { name: SCENARIO_NAME } });
  await prisma.site.deleteMany({ where: { code: SITE_CODE } });
  await prisma.headcountSnapshot.deleteMany({ where: { site: SITE_CODE } });

  for (const d of DIRECTIONS)
    await prisma.direction.upsert({ where: { code: d.code }, update: { ...d }, create: { ...d } });
  for (const [code, g] of Object.entries(data.groups))
    await prisma.pole.upsert({
      where: { groupCode: code },
      update: { label: g.label, directionCode: g.direction },
      create: { groupCode: code, label: g.label, directionCode: g.direction },
    });

  const site = await prisma.site.create({ data: { code: SITE_CODE, name: "Tunis" } });

  const positionKeys: { floorId: string; r: number; c: number; groupCode: string }[] = [];
  for (const [i, code] of FLOOR_ORDER.entries()) {
    const f = data.floors[code];
    const floor = await prisma.floor.create({ data: { siteId: site.id, code, label: f.label, ord: i } });

    const seats = f.cells.filter((x) => x.t === "seat");
    const positions: { r: number; c: number; kind: PositionKind; groupCode: string; zoneToFree: boolean }[] = seats.map((x) => ({
      r: x.r, c: x.c, kind: x.k ?? "c", groupCode: x.g ?? EMPTY_GROUP, zoneToFree: false,
    }));
    const taken = new Set(positions.map((p) => `${p.r}:${p.c}`));
    const cells = new Map<string, { r: number; c: number; type: PlanCellType }>();

    if (code === "RDC") {
      for (const x of f.cells.filter((y) => y.t === "free"))
        positions.push({ r: x.r, c: x.c, kind: "c", groupCode: FORMATION_GROUP, zoneToFree: true });
      const fm = f.cells.filter((y) => y.t === "free_m" && y.r === 20).sort((a, b) => a.c - b.c)[0];
      if (fm) positions.push({ r: fm.r, c: fm.c, kind: "m", groupCode: FORMATION_GROUP, zoneToFree: true });
    }
    for (const p of positions) taken.add(`${p.r}:${p.c}`);

    for (const x of f.cells) {
      if (x.t === "seat" || taken.has(`${x.r}:${x.c}`)) continue;
      let type: PlanCellType | null = null;
      if (x.t === "free_m") type = "desk";
      else if (x.t === "red") type = "wall"; // marquage rouge sans équivalent : traité comme mur
      else if (PLAN_TYPES.has(x.t)) type = x.t as PlanCellType;
      // les cellules « legend » (légende du dessin) ne sont pas stockées
      if (type) cells.set(`${x.r}:${x.c}`, { r: x.r, c: x.c, type });
    }
    for (const part of chunk([...cells.values()]))
      await prisma.planCell.createMany({ data: part.map((p) => ({ ...p, floorId: floor.id })) });

    const islandIdx = computeIslands(positions);
    const nIslands = islandIdx.length ? Math.max(...islandIdx) + 1 : 0;
    const islandRows: { id: string }[] = [];
    for (let n = 0; n < nIslands; n++) islandRows.push(await prisma.island.create({ data: { floorId: floor.id, index: n } }));
    for (const part of chunk(positions.map((p, k) => ({ p, k }))))
      await prisma.position.createMany({
        data: part.map(({ p, k }) => ({
          floorId: floor.id, islandId: islandRows[islandIdx[k]].id, r: p.r, c: p.c, kind: p.kind,
          type: typeOf(p.kind), groupCode: p.groupCode, reserved: false, zoneToFree: p.zoneToFree,
        })),
      });
    positions.forEach((p) => positionKeys.push({ floorId: floor.id, r: p.r, c: p.c, groupCode: p.groupCode }));
  }

  // Scénario de référence
  const scenario = await prisma.scenario.create({
    data: { name: SCENARIO_NAME, status: "DRAFT", isActive: true, reservePct: 0, recruitWindowMonths: 3, notes: "Situation actuelle issue du classeur." },
  });
  const byDir: Record<string, { cdi: number; externes: number; recrutements: number; fixedSeats: number }> = {};
  const now = new Date();
  for (const [code, g] of Object.entries(data.groups)) {
    const dir = GROUP_DIRECTION[code] ?? g.direction;
    if (dir === "SUPPORT") continue;
    const a = (byDir[dir] ??= { cdi: 0, externes: 0, recrutements: 0, fixedSeats: 0 });
    a.cdi += g.cdi.d + g.cdi.m + g.cdi.c;
    a.fixedSeats += g.cdi.d + g.cdi.m;
    a.externes += g.externes;
    a.recrutements += g.recrutements;
    if (g.recrutements > 0)
      await prisma.recruitment.create({
        data: { scenarioId: scenario.id, directionCode: dir, poleCode: code, count: g.recrutements, source: "SIRH", expectedDate: now, reference: "Classeur situation 7" },
      });
    if (g.externes > 0)
      await prisma.externalConsultant.create({ data: { scenarioId: scenario.id, directionCode: dir, poleCode: code, count: g.externes } });
    for (const [kind, count] of [["d", g.cdi.d], ["m", g.cdi.m], ["c", g.cdi.c], ["e", g.externes]] as const)
      await prisma.headcountSnapshot.create({ data: { groupCode: code, kind, count, site: SITE_CODE } });
  }
  for (const [directionCode, v] of Object.entries(byDir))
    await prisma.scenarioDirectionParam.create({ data: { scenarioId: scenario.id, directionCode, ...v } });

  // Affectations = direction actuelle de chaque position (V et zone à libérer : aucune)
  const dbPositions = await prisma.position.findMany({ select: { id: true, floorId: true, r: true, c: true, groupCode: true } });
  const toAssign = dbPositions.flatMap((p) => {
    const dir = GROUP_DIRECTION[p.groupCode];
    return dir ? [{ scenarioId: scenario.id, positionId: p.id, directionCode: dir }] : [];
  });
  for (const part of chunk(toAssign, 1000)) await prisma.assignment.createMany({ data: part });

  const total = await prisma.position.count();
  console.log(`Seed terminé : ${total} positions, ${toAssign.length} affectations.`);
}

main().finally(() => prisma.$disconnect());
