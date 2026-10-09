"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/plans", label: "Plans" },
  { href: "/parametres", label: "Paramètres" },
  { href: "/proposition", label: "Proposition" },
  { href: "/scenarios", label: "Scénarios" },
  { href: "/import", label: "Import" },
  { href: "/connexion", label: "Connexion" },
];

export interface NavProps {
  /** Liens masqués pour l'utilisateur courant (droits insuffisants). */
  hidden?: readonly string[];
  /** Libellé de la session courante (rôle, direction), affiché à côté du lien Connexion. */
  who?: string | null;
}

export default function Nav({ hidden = [], who = null }: NavProps) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {NAV_LINKS.filter((l) => !hidden.includes(l.href)).map((l) => {
        const current = l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined} title={l.href === "/connexion" && who ? `Session : ${who}` : undefined}>
            {l.href === "/connexion" && who ? who : l.label}
          </Link>
        );
      })}
    </nav>
  );
}
