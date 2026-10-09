"use server";

import { AuthError, requirePermission } from "@/lib/auth";
import { applyImport, previewImport, ImportError } from "@/lib/import/service";
import type { ImportPreview } from "@/lib/import/types";

const MAX_BYTES = 10 * 1024 * 1024;

export type PreviewState = { ok: true; preview: ImportPreview } | { ok: false; error: string };
export type ConfirmState = { ok: true; message: string } | { ok: false; error: string };

async function readInput(formData: FormData) {
  const file = formData.get("fichier");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  if (!(file instanceof File) || file.size === 0) throw new ImportError("Sélectionnez un fichier .xlsx ou .csv.");
  if (file.size > MAX_BYTES) throw new ImportError("Fichier trop volumineux (10 Mo maximum).");
  if (!scenarioId) throw new ImportError("Choisissez un scénario.");
  return { buffer: Buffer.from(await file.arrayBuffer()), name: file.name, scenarioId };
}

function toError(e: unknown): { ok: false; error: string } {
  if (e instanceof ImportError) return { ok: false, error: e.message };
  if (e instanceof AuthError) {
    return { ok: false, error: e.status === 401 ? "Session expirée : reconnectez-vous." : "Vous n'avez pas le droit d'importer l'effectif RH." };
  }
  console.error("[import]", e);
  return { ok: false, error: "Erreur inattendue pendant l'import. Consultez les journaux du serveur." };
}

export async function previewAction(formData: FormData): Promise<PreviewState> {
  try {
    await requirePermission("import");
    const { buffer, name, scenarioId } = await readInput(formData);
    return { ok: true, preview: await previewImport(buffer, name, scenarioId) };
  } catch (e) {
    return toError(e);
  }
}

/** Le fichier est renvoyé et ré-analysé : rien n'est stocké entre la prévisualisation et la confirmation. */
export async function confirmAction(formData: FormData): Promise<ConfirmState> {
  try {
    const session = await requirePermission("import");
    const { buffer, name, scenarioId } = await readInput(formData);
    const actor = session.user.email ?? session.user.name ?? `${session.user.role}`;
    const r = await applyImport(buffer, name, scenarioId, actor);
    return { ok: true, message: `Import enregistré : ${r.retenues} personnes du site de Tunis comptabilisées, paramètres du scénario mis à jour.` };
  } catch (e) {
    return toError(e);
  }
}
