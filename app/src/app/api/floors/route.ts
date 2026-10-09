import { handle } from "@/lib/services/http";
import { listFloors } from "@/lib/services/plans";

export const dynamic = "force-dynamic";

/** GET /api/floors : niveaux du site. */
export const GET = () => handle(listFloors);
