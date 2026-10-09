import { handle, readJson } from "@/lib/services/http";
import { createScenario, listScenarios } from "@/lib/services/scenarios";

export const dynamic = "force-dynamic";

/** GET /api/scenarios : liste. POST : création `{ name, notes?, fromScenarioId?, reservePct?, recruitWindowMonths? }` (201). */
export const GET = () => handle(listScenarios);
export const POST = async (req: Request) => handle(async () => createScenario(await readJson(req) as never), 201);
