import { handle } from "@/lib/services/http";
import { removeExternal } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; eid: string }> };

/** DELETE /api/scenarios/:id/externals/:eid */
export const DELETE = async (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id, eid } = await params;
    return removeExternal(id, eid);
  });
