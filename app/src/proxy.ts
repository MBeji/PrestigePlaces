/**
 * Proxy Next 16 (ex-middleware) : protège toutes les pages et API, sauf /connexion et /api/auth.
 * Sans session valide : redirection vers /connexion (401 pour les API).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { decideAccess } from "@/lib/auth/access";
import { readAuthEnv } from "@/lib/auth/env";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { secret, required } = readAuthEnv();
  // Application ouverte : aucune connexion demandée, la page de connexion renvoie à l'accueil.
  if (!required) {
    return pathname === "/connexion" ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  let authenticated = false;
  if (secret) {
    try {
      // Le nom du cookie (préfixe __Secure-) dépend du protocole réellement servi, pas de l'hébergeur.
      const token = await getToken({ req: request, secret, secureCookie: request.nextUrl.protocol === "https:" });
      authenticated = !!token?.role;
    } catch {
      authenticated = false;
    }
  }
  const decision = decideAccess(pathname, search, authenticated);
  if (decision.type === "next") return NextResponse.next();
  if (decision.type === "unauthorized") {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  return NextResponse.redirect(new URL(decision.location, request.url));
}

export const config = {
  // Exclut les ressources statiques de Next et les fichiers publics.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$).*)"],
};
