/** Accès à la session côté serveur et contrôles d'accès pour les server actions et routes. */
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./options";
import { can, roleOf, type Action, type AppRole, type PermissionContext } from "./permissions";

export type AppSession = Session;

/** Session courante (JWT enrichi : role, directionCode), ou null. Sans rôle reconnu : null. */
export async function getSession(): Promise<AppSession | null> {
  const session = await getServerSession(authOptions);
  return session && roleOf(session) ? session : null;
}

/** Erreur d'accès : 401 sans session, 403 si le rôle ne suffit pas. */
export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Exige une session dont le rôle figure dans `roles` (ou n'importe quel rôle si la liste est vide).
 * Lève AuthError sinon. À appeler en tête de chaque server action ou route.
 */
export async function requireRole(...roles: AppRole[]): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Authentification requise");
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    throw new AuthError(403, "Accès refusé pour ce rôle");
  }
  return session;
}

/** Exige le droit `action` (matrice de can()), éventuellement sur une direction. */
export async function requirePermission(action: Action, ctx: PermissionContext = {}): Promise<AppSession> {
  const session = await requireRole();
  if (!can(session, action, ctx)) throw new AuthError(403, "Action non autorisée");
  return session;
}

/** Convertit une AuthError en réponse JSON (pour les routes) ; relance les autres erreurs. */
export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
