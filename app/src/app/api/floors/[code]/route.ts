import { handle } from "@/lib/services/http";
import { getFloorPlan } from "@/lib/services/plans";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ code: string }> };

/** GET /api/floors/:code?scenarioId= : cellules, positions et affectations (scénario actif par défaut). */
export const GET = async (req: Request, { params }: Ctx) =>
  handle(async () => getFloorPlan((await params).code, new URL(req.url).searchParams.get("scenarioId")));
