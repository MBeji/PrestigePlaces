import { handle, readJson } from "@/lib/services/http";
import { saveSimulation, simulateScenario } from "@/lib/services/simulation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/scenarios/:id/simulation `{ titre, reservePct?, directions?: [{ code, cdi?, externes?, recrutements? }], niveauxALiberer? }` :
 * simulation sans écriture. Avec `?enregistrer=1` et `{ name, hypotheses }` : enregistre la simulation comme nouveau scénario.
 */
export const POST = async (req: Request, { params }: Ctx) =>
  handle(async () => {
    const id = (await params).id;
    const body = await readJson(req);
    return new URL(req.url).searchParams.get("enregistrer") === "1" ? saveSimulation(id, body as never) : simulateScenario(id, body);
  });
