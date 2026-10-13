import { errorResponse } from "@/lib/services/errors";
import { getProposalExport } from "@/lib/services/proposal";
import { exportFileName, proposalWorkbookBuffer } from "@/lib/export/proposalWorkbook";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/scenarios/:id/proposal/export : classeur Excel de la proposition (positions, récapitulatifs par direction et par équipe). */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  try {
    const data = await getProposalExport((await params).id);
    const body = new Uint8Array(proposalWorkbookBuffer(data));
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFileName(data.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
