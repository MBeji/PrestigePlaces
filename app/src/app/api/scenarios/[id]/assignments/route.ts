import { handle } from "@/lib/services/http";
import { getAssignmentSummary } from "@/lib/services/plans";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/assignments : comptes par direction et par niveau. */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getAssignmentSummary((await params).id));
