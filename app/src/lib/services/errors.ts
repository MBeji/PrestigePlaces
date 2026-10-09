import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

/** Erreur métier des services, avec un code HTTP et un code machine stable. */
export class ServiceError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 422,
    public readonly code: "VALIDATION" | "INTROUVABLE" | "CONFLIT" | "REGLE_METIER",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const notFound = (what: string) => new ServiceError(404, "INTROUVABLE", `${what} introuvable.`);

/** Valide une entrée avec zod ; lève ServiceError 400 (messages en français). */
export function parseInput<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: ZodError } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ champ: i.path.join("."), message: i.message }));
  throw new ServiceError(400, "VALIDATION", `Données invalides : ${issues.map((i) => `${i.champ || "corps"} (${i.message})`).join(", ")}`, issues);
}

/** Convertit n'importe quelle erreur en réponse JSON `{ error, code, details? }`. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return Response.json({ error: e.message, code: e.status === 401 ? "NON_AUTHENTIFIE" : "INTERDIT" }, { status: e.status });
  if (e instanceof ServiceError) return Response.json({ error: e.message, code: e.code, details: e.details }, { status: e.status });
  if (e instanceof SyntaxError) return Response.json({ error: "Corps JSON invalide.", code: "VALIDATION" }, { status: 400 });
  console.error(e);
  return Response.json({ error: "Erreur interne.", code: "ERREUR_INTERNE" }, { status: 500 });
}
