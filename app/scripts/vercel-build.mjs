// Build de déploiement (Vercel l'exécute automatiquement via le script npm « vercel-build »).
// - Avec PostgreSQL (DATABASE_URL, POSTGRES_PRISMA_URL ou POSTGRES_URL) : schéma poussé, seed seulement si la base est vide.
// - Sans PostgreSQL : base SQLite de démonstration prisma/demo.db, construite et ensemencée ici, embarquée dans le déploiement.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const env = { ...process.env };
const pg = [env.DATABASE_URL, env.POSTGRES_PRISMA_URL, env.POSTGRES_URL].find((u) => u && /^postgres(ql)?:\/\//.test(u));
const run = (cmd, extra = {}) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
};

if (pg) {
  console.log("Base : PostgreSQL");
  const db = { DB_PROVIDER: "postgresql", DATABASE_URL: pg };
  run("node scripts/set-db-provider.mjs", db);
  run("npx prisma generate", db);
  run("npx prisma db push --skip-generate", db);
  run("npx tsx prisma/seed.ts", { ...db, SEED_IF_EMPTY: "true" });
} else {
  console.log("Base : SQLite de démonstration (aucun PostgreSQL configuré ; les écritures ne seront pas durables)");
  const db = { DB_PROVIDER: "sqlite", DATABASE_URL: "file:./demo.db" };
  if (existsSync("prisma/demo.db")) rmSync("prisma/demo.db");
  run("node scripts/set-db-provider.mjs", db);
  run("npx prisma generate", db);
  run("npx prisma db push --skip-generate", db);
  run("npx tsx prisma/seed.ts", db);
}
run("npx next build");
