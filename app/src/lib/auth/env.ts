/**
 * Lecture des variables d'environnement d'authentification (module pur, utilisable dans le proxy).
 *
 * - AUTH_DEV_MODE=true : active le fournisseur de développement (sélecteur de rôle sans mot de passe).
 *   AUTH_DEV_LOGIN est accepté comme alias historique si AUTH_DEV_MODE est absent.
 * - AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET / AZURE_AD_TENANT_ID : fournisseur Entra ID.
 * - NEXTAUTH_SECRET (ou AUTH_SECRET) : clé de signature des JWT, obligatoire hors mode développement.
 * - AUTH_DEFAULT_ROLE : rôle donné à un compte SSO absent de la table UserRole
 *   (LECTURE par défaut, AUCUN pour refuser la connexion).
 */
import { isRole, type AppRole } from "./permissions";

/** Clé utilisée uniquement en mode développement, quand NEXTAUTH_SECRET est absent. */
export const DEV_FALLBACK_SECRET = "prestigeplaces-dev-secret-non-utilisable-en-production";

export interface AuthEnv {
  devMode: boolean;
  azure: { clientId: string; clientSecret: string; tenantId: string } | null;
  secret: string | undefined;
  /** null : un compte SSO inconnu de UserRole est refusé. */
  defaultRole: AppRole | null;
}

type Env = Record<string, string | undefined>;

function flag(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return ["true", "1", "yes", "oui"].includes(value.trim().toLowerCase());
}

export function readAuthEnv(env: Env = process.env): AuthEnv {
  const devMode = flag(env.AUTH_DEV_MODE) ?? flag(env.AUTH_DEV_LOGIN) ?? false;
  const clientId = env.AZURE_AD_CLIENT_ID?.trim();
  const clientSecret = env.AZURE_AD_CLIENT_SECRET?.trim();
  const tenantId = env.AZURE_AD_TENANT_ID?.trim();
  const azure = clientId && clientSecret && tenantId ? { clientId, clientSecret, tenantId } : null;
  const configured = env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim() || undefined;
  const secret = configured ?? (devMode ? DEV_FALLBACK_SECRET : undefined);
  const rawDefault = env.AUTH_DEFAULT_ROLE?.trim().toUpperCase();
  const defaultRole = rawDefault === "AUCUN" || rawDefault === "NONE" ? null : isRole(rawDefault) ? rawDefault : "LECTURE";
  return { devMode, azure, secret, defaultRole };
}
