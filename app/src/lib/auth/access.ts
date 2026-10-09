/** Décision d'accès du proxy (module pur, testable). */

export const LOGIN_PATH = "/connexion";
/** Préfixes accessibles sans session. */
export const PUBLIC_PREFIXES = [LOGIN_PATH, "/api/auth"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export type AccessDecision =
  | { type: "next" }
  | { type: "unauthorized" }
  | { type: "redirect"; location: string };

/**
 * - chemins publics (/connexion, /api/auth/...) : laissés passer ;
 * - session valide : laissée passer ;
 * - API sans session : 401 ;
 * - page sans session : redirection vers /connexion?callbackUrl=<chemin demandé>.
 */
export function decideAccess(pathname: string, search: string, authenticated: boolean): AccessDecision {
  if (isPublicPath(pathname) || authenticated) return { type: "next" };
  if (pathname === "/api" || pathname.startsWith("/api/")) return { type: "unauthorized" };
  const target = `${pathname}${search}`;
  const query = target === "/" ? "" : `?callbackUrl=${encodeURIComponent(target)}`;
  return { type: "redirect", location: `${LOGIN_PATH}${query}` };
}

/** N'accepte qu'un chemin interne (évite les redirections ouvertes). */
export function safeCallbackPath(value: string | string[] | undefined | null): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (isPublicPath(v.split("?")[0])) return "/";
  return v;
}
