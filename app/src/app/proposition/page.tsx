import { getDirectionParams, getProposal, ServiceError, type ProposalView } from "@/lib/services";
import { chooseScenario, currentRights } from "@/components/params/data";
import ScenarioSelect from "@/components/params/ScenarioSelect";
import ProposalActions from "@/components/params/ProposalActions";
import ProposalTable from "@/components/params/ProposalTable";
import MovementList from "@/components/params/MovementList";
import { commonRate, countDirectionChanges, formatRatio, STATUS_LABELS } from "@/components/params/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposition – PrestigePlaces" };

export default async function Page({ searchParams }: PageProps<"/proposition">) {
  const sp = await searchParams;
  const requested = typeof sp.scenario === "string" ? sp.scenario : undefined;
  const { scenarios, selected } = await chooseScenario(requested);
  if (!selected) {
    return (
      <section className="panel">
        <h1>Proposition</h1>
        <p className="soon">Aucun scénario : initialisez la base avec « npm run db:seed ».</p>
      </section>
    );
  }

  let proposal: ProposalView | null = null;
  try {
    proposal = await getProposal(selected.id);
  } catch (e) {
    if (!(e instanceof ServiceError && e.status === 404)) throw e;
  }
  const dirs = await getDirectionParams(selected.id);
  const rights = await currentRights(dirs.map((d) => d.directionCode));
  const fixedSeats = Object.fromEntries(dirs.map((d) => [d.directionCode, d.fixedSeats]));

  return (
    <>
      <h1>Proposition</h1>
      <p className="sub">Répartition des positions par direction selon les quotas, puis par niveau et par îlot.</p>
      <div style={{ marginBottom: 12 }}>
        <ScenarioSelect basePath="/proposition" scenarios={scenarios} value={selected.id} />
      </div>
      <ProposalActions
        scenarioId={selected.id}
        proposalId={proposal?.scenarioId ?? null}
        status={proposal?.status ?? null}
        canCalculate={rights.calculer}
        canValidate={rights.valider}
        hasProposal={proposal !== null}
      />
      {!proposal ? (
        <section className="panel"><p className="soon" style={{ margin: 0 }}>Aucune proposition calculée pour ce scénario.</p></section>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="kpis" style={{ marginBottom: 0 }}>
            <div className="kpi"><div className="l">Changent de direction</div><div className="v">{proposal.kpis.changes}</div></div>
            <div className="kpi"><div className="l">Positions à répartir</div><div className="v">{proposal.kpis.positionsToAllocate}</div></div>
            <div className="kpi"><div className="l">Effectif cible</div><div className="v">{proposal.kpis.targetHeadcount}</div></div>
            <div className="kpi"><div className="l">Taux commun</div><div className="v">{formatRatio(commonRate(proposal.kpis.positionsToAllocate, proposal.kpis.targetHeadcount))}</div></div>
            <div className="kpi"><div className="l">Statut</div><div className="v" style={{ fontSize: 16 }}>{STATUS_LABELS[proposal.status] ?? proposal.status}</div></div>
          </div>
          <section className="panel">
            <ProposalTable
              data={{
                quota: proposal.quota, current: proposal.current, targetHeadcount: proposal.targetHeadcount,
                floorsBefore: proposal.kpis.floorsBefore, floorsAfter: proposal.kpis.floorsAfter, fixedSeats,
              }}
            />
            {proposal.floorPlan.feasible === false && <p role="alert" style={{ color: "var(--critical)" }}>La répartition par niveau n&apos;est pas entièrement réalisable : vérifiez les quotas.</p>}
            {proposal.kpis.reserve > 0 && <p className="sub" style={{ marginBottom: 0 }}>{proposal.kpis.reserve} positions gardées en réserve.</p>}
          </section>
          <section className="panel">
            <h2 style={{ fontSize: 16, marginTop: 0 }}>
              Mouvements ({proposal.movements.length}, dont {countDirectionChanges(proposal.movements)} changements de direction)
            </h2>
            <MovementList movements={proposal.movements} />
          </section>
        </div>
      )}
    </>
  );
}
