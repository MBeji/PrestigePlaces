import { handle } from "@/lib/services/http";
import { removeRecruitment } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; rid: string }> };

/** DELETE /api/scenarios/:id/recruitments/:rid */
export const DELETE = async (_req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id, rid } = await params;
    return removeRecruitment(id, rid);
  });
