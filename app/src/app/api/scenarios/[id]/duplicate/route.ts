import { handle, readJson } from "@/lib/services/http";
import { duplicateScenario } from "@/lib/services/scenarios";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scenarios/:id/duplicate `{ name? }` (201) */
export const POST = async (req: Request, { params }: Ctx) => handle(async () => duplicateScenario((await params).id, (await readJson(req)) as never), 201);
