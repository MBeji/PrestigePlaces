import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  DB_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AUTH_DEV_MODE: z.enum(["true", "false"]).optional(),
  /** Alias historique de AUTH_DEV_MODE. */
  AUTH_DEV_LOGIN: z.enum(["true", "false"]).optional(),
  AUTH_DEFAULT_ROLE: z.string().optional(),
  STORE_PERSONS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  PERSON_HASH_SALT: z.string().optional(),
}).transform((v) => ({ ...v, authDevMode: (v.AUTH_DEV_MODE ?? v.AUTH_DEV_LOGIN ?? "false") === "true" }));

export type AppConfig = z.infer<typeof schema>;

/** Lit et valide les variables d'environnement (chaînes vides ignorées). */
export function parseConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  return schema.parse(cleaned);
}

let cached: AppConfig | undefined;
export function getConfig(): AppConfig {
  return (cached ??= parseConfig());
}
