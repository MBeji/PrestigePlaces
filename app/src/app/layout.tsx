import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import { can, getSession, readAuthEnv, ROLE_LABELS } from "@/lib/auth";
import { isDemoDatabase } from "@/lib/dbUrl";
import { DIRECTIONS } from "@/lib/directions";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrestigePlaces – Dispatching des places",
  description: "Répartition des places de travail par direction, site de Tunis.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Liens masqués selon les droits (les pages et services vérifient de toute façon).
  const open = !readAuthEnv().required;
  const hidden = open
    ? ["/connexion"]
    : session
      ? can(session, "import") ? [] : ["/import"]
      : ["/plans", "/vue-3d", "/parametres", "/proposition", "/scenarios", "/import"];
  const direction = session?.user.directionCode ? DIRECTIONS.find((d) => d.code === session.user.directionCode)?.label : undefined;
  const who = session && !open ? `${ROLE_LABELS[session.user.role]}${direction ? ` – ${direction}` : ""}` : null;
  return (
    <html lang="fr">
      <body>
        <div className="shell">
          <header className="topbar">
            <p className="brand">
              <Link href="/" style={{ textDecoration: "none" }}>
                PrestigePlaces
              </Link>
            </p>
            <Nav hidden={hidden} who={who} />
          </header>
          {isDemoDatabase() && (
            <p role="status" className="demo-banner">
              Démonstration : base embarquée réinitialisée à chaque déploiement, les modifications ne sont pas conservées.
            </p>
          )}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
