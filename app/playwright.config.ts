import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout : base SQLite dédiée (prisma/e2e.db, recréée et seedée à chaque lancement),
 * serveur de production (build + start) sur un port dédié, connexion par le fournisseur de développement.
 * La base de développement (prisma/dev.db) n'est jamais touchée.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Chromium préinstallé : si la révision attendue par @playwright/test n'est pas présente dans
 * PLAYWRIGHT_BROWSERS_PATH, on prend le Chromium disponible (ne jamais lancer « playwright install »).
 * PW_CHROMIUM_PATH force un exécutable précis.
 */
function chromiumPath(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
    .map((d) => path.join(root, d, "chrome-linux", "chrome"))
    .filter((p) => existsSync(p));
  return candidates[0];
}

const executablePath = chromiumPath();

/**
 * WebGL en headless : sans GPU, Chromium n'autorise le rendu logiciel (SwiftShader) qu'avec ce drapeau. La vue 3D
 * peut ainsi monter son canvas ; les tests ne vérifient jamais le contenu rendu.
 */
const launchOptions = { args: ["--enable-unsafe-swiftshader"], ...(executablePath ? { executablePath } : {}) };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    trace: "retain-on-failure",
    launchOptions,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"], launchOptions } },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/services-generaux.json", launchOptions },
    },
  ],
  webServer: {
    command: `npm run e2e:db && npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/connexion`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: "file:./e2e.db",
      DB_PROVIDER: "sqlite",
      AUTH_DEV_MODE: "true",
      AUTH_DEFAULT_ROLE: "LECTURE",
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET: "e2e-secret-non-utilise-en-production",
      STORE_PERSONS: "false",
    },
  },
});
