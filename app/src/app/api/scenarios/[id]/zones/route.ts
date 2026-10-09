import { handle, readJson } from "@/lib/services/http";
import { getScenarioParams, setScenarioZones } from "@/lib/services/scenarioParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/zones (même vue que params) ; POST `{ positionIds: string[] }` remplace les zones supplémentaires. */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getScenarioParams((await params).id));
export const POST = async (req: Request, { params }: Ctx) => handle(async () => setScenarioZones((await params).id, (await readJson(req)) as never));
