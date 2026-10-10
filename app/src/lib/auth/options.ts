/** Configuration next-auth 4 : Entra ID (Azure AD) et, en mode développement, sélecteur de rôle. */
import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { parseDevLogin } from "./devLogin";
import { readAuthEnv } from "./env";
import { resolveRole, type UserRoleFinder } from "./resolveRole";

export const DEV_PROVIDER_ID = "dev";
export const AZURE_PROVIDER_ID = "azure-ad";
/** Fréquence de relecture de UserRole pour une session SSO (les changements de rôle s'appliquent sans reconnexion). */
const ROLE_REFRESH_MS = 5 * 60 * 1000;

function samePassword(given: unknown, expected: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const findUserRole: UserRoleFinder = (email) =>
  prisma.userRole.findUnique({ where: { email }, select: { role: true, directionCode: true } });

interface AzureProfile {
  sub?: string;
  oid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
}

export function buildAuthOptions(env = readAuthEnv()): NextAuthOptions {
  const providers: NextAuthOptions["providers"] = [];

  if (env.azure) {
    providers.push(
      AzureADProvider({
        clientId: env.azure.clientId,
        clientSecret: env.azure.clientSecret,
        tenantId: env.azure.tenantId,
        authorization: { params: { scope: "openid profile email" } },
        // Entra ID ne fournit pas toujours `email` : on retombe sur l'UPN.
        profile(profile: AzureProfile) {
          return {
            id: profile.oid ?? profile.sub ?? "",
            name: profile.name ?? null,
            email: profile.email ?? profile.preferred_username ?? profile.upn ?? null,
            image: null,
          };
        },
      }),
    );
  }

  if (env.devMode) {
    providers.push(
      CredentialsProvider({
        id: DEV_PROVIDER_ID,
        name: env.demoPassword ? "Démonstration" : "Développement",
        credentials: {
          role: { label: "Rôle", type: "text" },
          directionCode: { label: "Direction", type: "text" },
          name: { label: "Nom affiché", type: "text" },
          password: { label: "Mot de passe", type: "password" },
        },
        async authorize(credentials) {
          if (env.demoPassword && !samePassword(credentials?.password, env.demoPassword)) return null;
          return parseDevLogin(credentials);
        },
      }),
    );
  }

  return {
    secret: env.secret,
    providers,
    session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
    pages: { signIn: "/connexion", error: "/connexion" },
    callbacks: {
      async signIn({ user, account }) {
        if (account?.provider === DEV_PROVIDER_ID) return env.devMode;
        const resolved = await resolveRole(user.email, findUserRole, env.defaultRole);
        return resolved !== null;
      },
      async jwt({ token, user, account }) {
        if (user && account) {
          token.provider = account.provider;
          if (account.provider === DEV_PROVIDER_ID) {
            token.role = user.role;
            token.directionCode = user.directionCode ?? null;
            return token;
          }
        }
        if (token.provider === DEV_PROVIDER_ID) return token;
        const stale = !token.roleCheckedAt || Date.now() - token.roleCheckedAt > ROLE_REFRESH_MS;
        if (stale || !token.role) {
          const resolved = await resolveRole(token.email, findUserRole, env.defaultRole);
          token.role = resolved?.role;
          token.directionCode = resolved?.directionCode ?? null;
          token.roleCheckedAt = Date.now();
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user && token.role) {
          session.user.role = token.role;
          session.user.directionCode = token.directionCode ?? null;
        }
        return session;
      },
    },
  };
}

export const authOptions: NextAuthOptions = buildAuthOptions();
