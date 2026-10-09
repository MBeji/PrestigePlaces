import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { DRAFT: "Brouillon", PROPOSED: "Proposé", VALIDATED: "Validé", PUBLISHED: "Publié" };

export default async function Home() {
  const scenario =
    (await prisma.scenario.findFirst({ where: { isActive: true } })) ??
    (await prisma.scenario.findFirst({ orderBy: { createdAt: "desc" } }));

  if (!scenario) {
    return (
      <section className="panel">
        <h1>Aucun scénario</h1>
        <p className="soon">Initialisez la base avec « npm run db:seed ».</p>
      </section>
    );
  }

  const [directions, grouped, total, zone] = await Promise.all([
    prisma.direction.findMany({ orderBy: { code: "asc" } }),
    prisma.assignment.groupBy({ by: ["directionCode"], where: { scenarioId: scenario.id }, _count: { _all: true } }),
    prisma.position.count(),
    prisma.position.count({ where: { zoneToFree: true } }),
  ]);
  const counts = new Map(grouped.map((g) => [g.directionCode, g._count._all]));
  const assigned = [...counts.values()].reduce((a, b) => a + b, 0);
  const order = ["AMMAR", "BOUBAKER", "ZEINEB", "AMINE", "BEJI", "SUPPORT"];
  const sorted = [...directions].sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));

  return (
    <>
      <h1>{scenario.name}</h1>
      <p className="sub">
        Statut : {STATUS[scenario.status] ?? scenario.status} · Site de Tunis · {total} positions, dont {zone} en zone à libérer
        et {total - assigned - zone} vides.
      </p>
      <div className="kpis">
        {sorted.map((d) => (
          <div className="kpi" key={d.code}>
            <div className="l">
              <span className="sw" style={{ background: d.color }} />
              {d.label}
              {d.inEquation ? "" : " (hors équation)"}
            </div>
            <div className="v">{counts.get(d.code) ?? 0}</div>
          </div>
        ))}
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th className="num">Positions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.code}>
                <td>{d.label}</td>
                <td className="num">{counts.get(d.code) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
