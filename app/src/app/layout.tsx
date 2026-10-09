import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrestigePlaces – Dispatching des places",
  description: "Répartition des places de travail par direction, site de Tunis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <Nav />
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
