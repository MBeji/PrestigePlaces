import { handle, readJson } from "@/lib/services/http";
import { getScenarioParams, updateScenarioParams } from "@/lib/services/scenarioParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/params ; POST `{ reservePct?, recruitWindowMonths?, notes? }` */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getScenarioParams((await params).id));
export const POST = async (req: Request, { params }: Ctx) => handle(async () => updateScenarioParams((await params).id, (await readJson(req)) as never));
