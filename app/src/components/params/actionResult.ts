import { AuthError } from "@/lib/auth";
import { ServiceError } from "@/lib/services/errors";

/** Exécute un appel de service et convertit les erreurs métier ou de droits en message français. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<{ ok: true; message?: string; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, message, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.status === 401 ? "Session expirée : reconnectez-vous." : "Vous n'avez pas le droit de réaliser cette action." };
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Erreur inattendue. Réessayez ou consultez le journal du serveur." };
  }
}
