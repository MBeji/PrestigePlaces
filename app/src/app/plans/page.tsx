import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth";
import { ServiceError } from "@/lib/services";
import PlanViewer from "@/components/plan/PlanViewer";
import { isPlanView } from "@/components/plan/model";
import { loadPlansPage, type PlansPageData } from "./load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans – PrestigePlaces" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const scenario = first(sp.scenario);
  const niveau = first(sp.niveau);
  const vue = first(sp.vue);

  let data: PlansPageData | null = null;
  let failure: { status: number; message: string } | null = null;
  try {
    data = await loadPlansPage(scenario);
  } catch (e) {
    if (e instanceof AuthError) failure = { status: e.status, message: e.message };
    else if (e instanceof ServiceError) failure = { status: e.status, message: e.message };
    else throw e;
  }
  if (failure?.status === 401) {
    const target = `/plans${scenario ? `?scenario=${encodeURIComponent(scenario)}` : ""}`;
    redirect(`/connexion?callbackUrl=${encodeURIComponent(target)}`);
  }

  return (
    <>
      <h1>Plans</h1>
      <p className="sub">
        Plans des cinq niveaux du site de Tunis : situation du scénario, proposition de dispatching et changements. Les fonctions support restent en place ;
        le centre du RDC est libéré pour la salle de formation.
      </p>
      {failure ? (
        <section className="panel" role="alert">
          <p>{failure.status === 403 ? "Vous n'avez pas accès aux plans." : failure.message}</p>
        </section>
      ) : !data ? (
        <section className="panel">
          <p className="soon">Aucun scénario en base. Initialisez la base avec « npm run db:seed ».</p>
        </section>
      ) : (
        <PlanViewer
          key={`${data.scenarioId}:${data.proposal?.id ?? ""}`}
          floors={data.floors}
          directions={data.directions}
          scenarios={data.scenarios}
          scenarioId={data.scenarioId}
          proposal={data.proposal}
          initialFloor={niveau}
          initialView={isPlanView(vue) ? vue : undefined}
        />
      )}
    </>
  );
}
