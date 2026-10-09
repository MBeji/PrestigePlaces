import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Crée une base SQLite temporaire (schéma poussé + seed) et fixe DATABASE_URL. À appeler avant d'importer db.ts. */
export function setupTempDb(): () => void {
  const dir = mkdtempSync(join(tmpdir(), "pp-test-"));
  const url = `file:${join(dir, "test.db")}`;
  const env = { ...process.env, DATABASE_URL: url, DB_PROVIDER: "sqlite" };
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { env, stdio: "pipe" });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env, stdio: "pipe" });
  process.env.DATABASE_URL = url;
  return () => rmSync(dir, { recursive: true, force: true });
}

export type FakeUser = { role: string; directionCode?: string | null; email?: string };
export const sessionOf = (u: FakeUser) => ({ user: { name: "Test", email: u.email ?? "test@example.org", role: u.role, directionCode: u.directionCode ?? null } });
