import { handle } from "@/lib/services/http";
import { getScenario } from "@/lib/services/scenarios";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getScenario((await params).id));
