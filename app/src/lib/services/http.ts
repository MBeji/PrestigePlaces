import { errorResponse } from "./errors";

/** Enveloppe de route : exécute `fn`, renvoie `data` en JSON (200 ou `status`), convertit les erreurs. */
export async function handle<T>(fn: () => Promise<T>, status = 200): Promise<Response> {
  try {
    return Response.json(await fn(), { status });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Lit le corps JSON (objet vide si le corps est absent). */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  return text.trim() ? JSON.parse(text) : {};
}
