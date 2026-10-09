import { handle } from "@/lib/services/http";
import { setActiveScenario } from "@/lib/services/scenarios";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scenarios/:id/activate : désigne le scénario actif. */
export const POST = async (_req: Request, { params }: Ctx) => handle(async () => setActiveScenario((await params).id));
