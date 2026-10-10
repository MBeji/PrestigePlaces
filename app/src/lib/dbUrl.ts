/**
 * Choix de l'URL de base de données à l'exécution.
 * - PostgreSQL si DATABASE_URL (ou POSTGRES_PRISMA_URL / POSTGRES_URL, noms posés par l'intégration Vercel) le désigne ;
 * - sur Vercel sans PostgreSQL : base SQLite de démonstration construite au build (prisma/demo.db),
 *   copiée dans /tmp au premier accès (écritures possibles mais non durables) ;
 * - sinon DATABASE_URL tel quel (SQLite de développement).
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Env = Record<string, string | undefined>;

export function postgresUrl(env: Env = process.env): string | undefined {
  return [env.DATABASE_URL, env.POSTGRES_PRISMA_URL, env.POSTGRES_URL].find((u) => !!u && /^postgres(ql)?:\/\//.test(u));
}

export const DEMO_DB_TMP = "/tmp/prestigeplaces-demo.db";

export function resolveDatabaseUrl(env: Env = process.env, cwd = process.cwd()): string | undefined {
  const pg = postgresUrl(env);
  if (pg) return pg;
  if (env.VERCEL) {
    const bundled = join(cwd, "prisma", "demo.db");
    if (!existsSync(DEMO_DB_TMP) && existsSync(bundled)) copyFileSync(bundled, DEMO_DB_TMP);
    return `file:${DEMO_DB_TMP}`;
  }
  return env.DATABASE_URL;
}

/** Vrai quand l'application tourne sur la base de démonstration non durable. */
export function isDemoDatabase(env: Env = process.env): boolean {
  return !!env.VERCEL && !postgresUrl(env);
}
