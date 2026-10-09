import { handle, readJson } from "@/lib/services/http";
import { addExternal } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scenarios/:id/externals `{ directionCode, poleCode?, count, endDate? }` (201) */
export const POST = async (req: Request, { params }: Ctx) => handle(async () => addExternal((await params).id, (await readJson(req)) as never), 201);
