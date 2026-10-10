import { describe, expect, it } from "vitest";
import { readAuthEnv } from "@/lib/auth/env";
import { isDemoDatabase, postgresUrl, resolveDatabaseUrl } from "@/lib/dbUrl";

describe("base de données selon l'environnement", () => {
  it("préfère PostgreSQL, y compris sous les noms posés par Vercel", () => {
    expect(postgresUrl({ DATABASE_URL: "file:./dev.db", POSTGRES_PRISMA_URL: "postgres://u@h/db" })).toBe("postgres://u@h/db");
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgresql://u@h/db", VERCEL: "1" })).toBe("postgresql://u@h/db");
  });
  it("garde DATABASE_URL en local et signale la démonstration sur Vercel sans PostgreSQL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "file:./dev.db" })).toBe("file:./dev.db");
    expect(isDemoDatabase({ VERCEL: "1" })).toBe(true);
    expect(isDemoDatabase({ VERCEL: "1", POSTGRES_URL: "postgres://u@h/db" })).toBe(false);
  });
});

describe("connexion de démonstration", () => {
  it("s'active sur un serveur déployé seulement avec un mot de passe", () => {
    const prod = { NODE_ENV: "production", NEXTAUTH_URL: "https://prestigeplaces.vercel.app" };
    expect(readAuthEnv({ ...prod, AUTH_DEV_MODE: "true" }).devMode).toBe(false);
    const demo = readAuthEnv({ ...prod, AUTH_DEMO_PASSWORD: "s3cret-demo" });
    expect(demo.devMode).toBe(true);
    expect(demo.demoPassword).toBe("s3cret-demo");
    expect(demo.secret).toBeTruthy();
  });
  it("n'exige pas de mot de passe en développement local", () => {
    expect(readAuthEnv({ NODE_ENV: "development", AUTH_DEV_MODE: "true" }).demoPassword).toBeNull();
  });
});

describe("application ouverte", () => {
  it("n'exige pas d'authentification par défaut", () => {
    expect(readAuthEnv({ NODE_ENV: "production" }).required).toBe(false);
    expect(readAuthEnv({ NODE_ENV: "production", AUTH_REQUIRED: "true" }).required).toBe(true);
  });
});
