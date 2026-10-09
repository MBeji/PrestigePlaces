import { prisma } from "@/lib/db";
import { getDirectionParams, getScenarioParams } from "@/lib/services";
import { DIRECTIONS } from "@/lib/directions";
import { chooseScenario, currentRights } from "@/components/params/data";
import ScenarioSelect from "@/components/params/ScenarioSelect";
import ParamsEditor, { type DirectionRow } from "@/components/params/ParamsEditor";
import { STATUS_LABELS } from "@/components/params/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres – PrestigePlaces" };

export default async function Page({ searchParams }: PageProps<"/parametres">) {
  const sp = await searchParams;
  const requested = typeof sp.scenario === "string" ? sp.scenario : undefined;
  const { scenarios, selected } = await chooseScenario(requested);
  if (!selected) {
    return (
      <section className="panel">
        <h1>Paramètres</h1>
        <p className="soon">Aucun scénario : initialisez la base avec « npm run db:seed ».</p>
      </section>
    );
  }

  const [dirs, scenarioParams, pool] = await Promise.all([
    getDirectionParams(selected.id),
    getScenarioParams(selected.id),
    prisma.position.count({ where: { groupCode: { not: "SUP" }, zoneToFree: false } }),
  ]);
  const extraIds = new Set(scenarioParams.extraZones.map((z) => z.positionId));
  const extraInPool = extraIds.size
    ? await prisma.position.count({ where: { id: { in: [...extraIds] }, groupCode: { not: "SUP" }, zoneToFree: false } })
    : 0;
  const rights = await currentRights(dirs.map((d) => d.directionCode));
  const colorOf = new Map<string, string>(DIRECTIONS.map((d) => [d.code, d.color]));

  const rows: DirectionRow[] = dirs.map((d) => ({
    directionCode: d.directionCode, label: d.label, color: colorOf.get(d.directionCode) ?? "#888",
    cdi: d.cdi, externes: d.externes, recrutements: d.recrutements, fixedSeats: d.fixedSeats,
    recruitments: d.recruitments.map((r) => ({ id: r.id, count: r.count, source: r.source, expectedDate: r.expectedDate.toISOString(), reference: r.reference, counted: r.counted })),
    externals: d.externals.map((e) => ({ id: e.id, count: e.count, endDate: e.endDate ? e.endDate.toISOString() : null, counted: e.counted })),
  }));

  return (
    <>
      <h1>Paramètres</h1>
      <p className="sub">
        Effectif cible = CDI + consultants externes + recrutements comptés. Statut du scénario : {STATUS_LABELS[selected.status] ?? selected.status}.
      </p>
      <div style={{ marginBottom: 12 }}>
        <ScenarioSelect basePath="/parametres" scenarios={scenarios} value={selected.id} />
      </div>
      <ParamsEditor
        key={selected.id}
        scenarioId={selected.id}
        locked={selected.status === "VALIDATED" || selected.status === "PUBLISHED"}
        canManage={rights.gerer}
        editable={rights.editable}
        directions={rows}
        pool={pool - extraInPool}
        reservePct={scenarioParams.reservePct}
        recruitWindowMonths={scenarioParams.recruitWindowMonths}
        baseZoneCount={scenarioParams.baseZoneCount}
        extraZones={scenarioParams.extraZones}
      />
    </>
  );
}
