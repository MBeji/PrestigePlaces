/** Résolution du rôle d'un compte SSO depuis la table UserRole. */
import { isRole, type AppRole } from "./permissions";

export interface ResolvedRole {
  role: AppRole;
  directionCode: string | null;
}

export type UserRoleFinder = (email: string) => Promise<{ role: string; directionCode: string | null } | null>;

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/**
 * Cherche l'e-mail (normalisé en minuscules) dans UserRole.
 * Absent : `defaultRole` (null = connexion refusée).
 */
export async function resolveRole(
  email: string | null | undefined,
  find: UserRoleFinder,
  defaultRole: AppRole | null,
): Promise<ResolvedRole | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return defaultRole ? { role: defaultRole, directionCode: null } : null;
  const row = (await find(normalized)) ?? (email && email !== normalized ? await find(email) : null);
  if (row && isRole(row.role)) return { role: row.role, directionCode: row.directionCode ?? null };
  return defaultRole ? { role: defaultRole, directionCode: null } : null;
}
