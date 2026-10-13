import { chooseScenario, currentRights } from "@/components/params/data";
import ScenarioSelect from "@/components/params/ScenarioSelect";
import AiStudio from "@/components/ai/AiStudio";
import { loadAiPage } from "./load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scénarios IA – PrestigePlaces" };

export default async function Page({ searchParams }: PageProps<"/scenarios-ia">) {
  const sp = await searchParams;
  const requested = typeof sp.scenario === "string" ? sp.scenario : undefined;
  const { scenarios, selected } = await chooseScenario(requested);
  if (!selected) {
    return (
      <section className="panel">
        <h1>Scénarios IA</h1>
        <p className="soon">Aucun scénario : initialisez la base avec « npm run db:seed ».</p>
      </section>
    );
  }
  const data = await loadAiPage(selected.id);
  const rights = await currentRights([]);

  return (
    <>
      <h1>Scénarios IA</h1>
      <p className="sub">
        Décrivez un scénario en langage naturel : l&apos;assistant le traduit en hypothèses, l&apos;application calcule les quotas et dessine la
        répartition sur les plans, avec les règles d&apos;équité habituelles.
      </p>
      <div style={{ marginBottom: 12 }}>
        <ScenarioSelect basePath="/scenarios-ia" scenarios={scenarios} value={selected.id} />
      </div>
      <AiStudio key={selected.id} scenarioId={selected.id} context={data.context} floors={data.floors} directions={data.directions} canSave={rights.gerer} />
    </>
  );
}
