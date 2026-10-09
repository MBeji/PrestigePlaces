import { handle, readJson } from "@/lib/services/http";
import { updateDirectionParams } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; code: string }> };

/** POST /api/scenarios/:id/directions/:code `{ cdi?, externes?, recrutements? }` */
export const POST = async (req: Request, { params }: Ctx) =>
  handle(async () => {
    const { id, code } = await params;
    return updateDirectionParams(id, code, (await readJson(req)) as never);
  });
