import { handle, readJson } from "@/lib/services/http";
import { setScenarioStatus } from "@/lib/services/scenarios";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scenarios/:id/status `{ status: DRAFT|PROPOSED|VALIDATED|PUBLISHED }` */
export const POST = async (req: Request, { params }: Ctx) => handle(async () => setScenarioStatus((await params).id, (await readJson(req)) as never));
