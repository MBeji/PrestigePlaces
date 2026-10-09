import { handle } from "@/lib/services/http";
import { getDirectionParams } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/directions : paramètres des 5 directions + recrutements + externes. */
export const GET = async (_req: Request, { params }: Ctx) => handle(async () => getDirectionParams((await params).id));
