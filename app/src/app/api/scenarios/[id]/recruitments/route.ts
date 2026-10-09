import { handle, readJson } from "@/lib/services/http";
import { addRecruitment } from "@/lib/services/directionParams";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** POST /api/scenarios/:id/recruitments `{ directionCode, poleCode?, count, source: SIRH|MAIL_CLIENT, expectedDate, reference? }` (201) */
export const POST = async (req: Request, { params }: Ctx) => handle(async () => addRecruitment((await params).id, (await readJson(req)) as never), 201);
