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

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Navigation principale">
      {NAV_LINKS.map((l) => {
        const current = l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
