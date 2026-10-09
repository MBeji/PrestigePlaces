import { handle } from "@/lib/services/http";
import { getProposal, runProposal } from "@/lib/services/proposal";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/proposal : proposition calculée (404 si aucune). POST : lance le calcul (id source ou dérivé). */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getProposal((await params).id));
export const POST = async (_req: Request, { params }: Ctx) => handle(async () => runProposal((await params).id));
