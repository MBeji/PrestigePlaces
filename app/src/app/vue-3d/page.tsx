import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth";
import { ServiceError } from "@/lib/services";
import { isPlanView } from "@/components/plan/model";
import View3D from "@/components/plan3d/View3D";
import { loadPlansPage, type PlansPageData } from "../plans/load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vue 3D – PrestigePlaces" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Vue 3D du site : mêmes données que /plans (plans des 5 niveaux du scénario et de sa proposition, lus par les
 * services avec le droit « lire », ouvert à tous les rôles). Paramètres : scenario, niveau (absent = tous), vue.
 */
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
    const target = `/vue-3d${scenario ? `?scenario=${encodeURIComponent(scenario)}` : ""}`;
    redirect(`/connexion?callbackUrl=${encodeURIComponent(target)}`);
  }

  return (
    <>
      <h1>Vue 3D</h1>
      <p className="sub">
        Les cinq niveaux du site de Tunis empilés : situation du scénario, proposition de dispatching et changements, avec les effectifs par niveau,
        par direction et par open space. Le centre du RDC est libéré pour la salle de formation.
      </p>
      {failure ? (
        <section className="panel" role="alert">
          <p>{failure.status === 403 ? "Vous n'avez pas accès à la vue 3D." : failure.message}</p>
        </section>
      ) : !data ? (
        <section className="panel">
          <p className="soon">Aucun scénario en base. Initialisez la base avec « npm run db:seed ».</p>
        </section>
      ) : (
        <View3D
          key={`${data.scenarioId}:${data.proposal?.id ?? ""}`}
          floors={data.floors}
          directions={data.directions}
          scenarios={data.scenarios}
          scenarioId={data.scenarioId}
          proposal={data.proposal}
          initialFocus={niveau}
          initialView={isPlanView(vue) ? vue : undefined}
        />
      )}
    </>
  );
}
