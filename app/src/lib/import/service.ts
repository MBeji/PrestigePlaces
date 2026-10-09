import { prisma } from "@/lib/db";
import { aggregate, parseHrFile, ImportError } from "./parse";
import { compareAggregates, compareParams, paramsFromAggregate } from "./compare";
import { hashMatricule, storePersonsEnabled } from "./hash";
import { GROUP_CODES, SITE_CODE, isGroupCode } from "./groups";
import type { Aggregate, ImportPreview, Kind } from "./types";

export { ImportError };

/** Dernier instantané du site, sous forme d'agrégat. */
export async function loadLastSnapshot(): Promise<{ aggregate: Aggregate; importedAt: Date } | null> {
  const last = await prisma.headcountSnapshot.findFirst({ where: { site: SITE_CODE }, orderBy: { importedAt: "desc" } });
  if (!last) return null;
  const rows = await prisma.headcountSnapshot.findMany({ where: { site: SITE_CODE, importedAt: last.importedAt } });
  const agg = Object.fromEntries(GROUP_CODES.map((g) => [g, { d: 0, m: 0, c: 0 }])) as Aggregate;
  for (const r of rows) if (isGroupCode(r.groupCode) && (r.kind === "d" || r.kind === "m" || r.kind === "c")) agg[r.groupCode][r.kind as Kind] = r.count;
  return { aggregate: agg, importedAt: last.importedAt };
}

async function currentParams(scenarioId: string) {
  const rows = await prisma.scenarioDirectionParam.findMany({ where: { scenarioId } });
  return Object.fromEntries(rows.map((r) => [r.directionCode, { cdi: r.cdi, fixedSeats: r.fixedSeats }]));
}

async function getScenario(scenarioId: string) {
  const sc = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!sc) throw new ImportError("Scénario introuvable.");
  if (sc.status === "VALIDATED" || sc.status === "PUBLISHED") {
    throw new ImportError("Scénario validé ou publié : ses paramètres sont verrouillés. Dupliquez-le pour importer un nouvel effectif.");
  }
  return sc;
}

export async function previewImport(buffer: Buffer, filename: string, scenarioId: string): Promise<ImportPreview> {
  const scenario = await getScenario(scenarioId);
  const parsed = parseHrFile(buffer, filename);
  const agg = aggregate(parsed.rows);
  const last = await loadLastSnapshot();
  const diff = compareAggregates(last?.aggregate ?? null, agg);
  const sum = (f: (d: (typeof diff)[number]) => number) => diff.reduce((s, d) => s + f(d), 0);
  return {
    stats: parsed.stats,
    avertissements: parsed.avertissements,
    aPrecedent: !!last,
    dateReference: last ? last.importedAt.toISOString() : null,
    diff,
    totaux: { avant: sum((d) => d.avant.total), apres: sum((d) => d.apres.total), entrees: sum((d) => d.entrees), sorties: sum((d) => d.sorties) },
    parametres: compareParams(await currentParams(scenarioId), paramsFromAggregate(agg)),
    scenarioId,
    scenarioNom: scenario.name,
    stockagePersonnes: storePersonsEnabled(),
  };
}

/** Enregistre l'instantané, met à jour les paramètres du scénario et journalise. */
export async function applyImport(buffer: Buffer, filename: string, scenarioId: string, actor: string) {
  const scenario = await getScenario(scenarioId);
  const parsed = parseHrFile(buffer, filename);
  const agg = aggregate(parsed.rows);
  const params = paramsFromAggregate(agg);
  const store = storePersonsEnabled();
  const salt = process.env.PERSON_HASH_SALT ?? "";
  if (store && !salt) throw new ImportError("STORE_PERSONS=true exige PERSON_HASH_SALT (sel de hachage des matricules).");
  const importedAt = new Date();
  const snapshotRows = GROUP_CODES.flatMap((g) =>
    (["d", "m", "c"] as const).map((k) => ({ importedAt, groupCode: g, kind: k, count: agg[g][k], site: SITE_CODE })),
  );
  await prisma.$transaction(async (tx) => {
    await tx.headcountSnapshot.createMany({ data: snapshotRows });
    for (const [directionCode, v] of Object.entries(params)) {
      await tx.scenarioDirectionParam.upsert({
        where: { scenarioId_directionCode: { scenarioId, directionCode } },
        update: { cdi: v.cdi, fixedSeats: v.fixedSeats },
        create: { scenarioId, directionCode, cdi: v.cdi, fixedSeats: v.fixedSeats },
      });
    }
    if (store) {
      await tx.person.deleteMany({ where: { site: SITE_CODE } });
      await tx.person.createMany({
        data: parsed.rows.map((r) => ({ matriculeHash: hashMatricule(r.matricule, salt), groupCode: r.group, kind: r.kind, site: SITE_CODE })),
      });
    }
    await tx.auditLog.create({
      data: {
        actor,
        action: "IMPORT_EFFECTIF",
        entity: "Scenario",
        entityId: scenarioId,
        details: { fichier: filename, scenario: scenario.name, stats: parsed.stats, parametres: params, personnesStockees: store },
      },
    });
  });
  return { importedAt, retenues: parsed.stats.retenues, parametres: params };
}
