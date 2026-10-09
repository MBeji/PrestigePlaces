import { describe, expect, it, vi } from "vitest";
import { decideAccess, safeCallbackPath } from "@/lib/auth/access";
import { parseDevLogin } from "@/lib/auth/devLogin";
import { DEV_FALLBACK_SECRET, readAuthEnv } from "@/lib/auth/env";
import { resolveRole } from "@/lib/auth/resolveRole";

describe("decideAccess()", () => {
  it("laisse passer /connexion et /api/auth sans session", () => {
    expect(decideAccess("/connexion", "", false)).toEqual({ type: "next" });
    expect(decideAccess("/api/auth/session", "", false)).toEqual({ type: "next" });
  });
  it("redirige les pages sans session vers /connexion avec retour", () => {
    expect(decideAccess("/", "", false)).toEqual({ type: "redirect", location: "/connexion" });
    expect(decideAccess("/plans", "?niveau=2", false)).toEqual({
      type: "redirect",
      location: "/connexion?callbackUrl=%2Fplans%3Fniveau%3D2",
    });
    expect(decideAccess("/connexionX", "", false).type).toBe("redirect");
  });
  it("répond 401 aux API sans session", () => {
    expect(decideAccess("/api/scenarios", "", false)).toEqual({ type: "unauthorized" });
  });
  it("laisse passer une session valide", () => {
    expect(decideAccess("/parametres", "", true)).toEqual({ type: "next" });
  });
});

describe("safeCallbackPath()", () => {
  it("refuse les redirections externes", () => {
    expect(safeCallbackPath("https://exemple.com")).toBe("/");
    expect(safeCallbackPath("//exemple.com")).toBe("/");
    expect(safeCallbackPath("/connexion?x=1")).toBe("/");
    expect(safeCallbackPath(undefined)).toBe("/");
    expect(safeCallbackPath(["/plans", "/x"])).toBe("/plans");
    expect(safeCallbackPath("/plans?niveau=2")).toBe("/plans?niveau=2");
  });
});

describe("readAuthEnv()", () => {
  it("mode développement via AUTH_DEV_MODE (alias AUTH_DEV_LOGIN)", () => {
    expect(readAuthEnv({ AUTH_DEV_MODE: "true" }).devMode).toBe(true);
    expect(readAuthEnv({ AUTH_DEV_LOGIN: "true" }).devMode).toBe(true);
    expect(readAuthEnv({ AUTH_DEV_MODE: "false", AUTH_DEV_LOGIN: "true" }).devMode).toBe(false);
    expect(readAuthEnv({}).devMode).toBe(false);
  });
  it("secret de repli uniquement en mode développement", () => {
    expect(readAuthEnv({ AUTH_DEV_MODE: "true" }).secret).toBe(DEV_FALLBACK_SECRET);
    expect(readAuthEnv({}).secret).toBeUndefined();
    expect(readAuthEnv({ NEXTAUTH_SECRET: "s" }).secret).toBe("s");
  });
  it("Azure configuré seulement si les trois variables sont présentes", () => {
    expect(readAuthEnv({ AZURE_AD_CLIENT_ID: "a", AZURE_AD_CLIENT_SECRET: "b" }).azure).toBeNull();
    expect(readAuthEnv({ AZURE_AD_CLIENT_ID: "a", AZURE_AD_CLIENT_SECRET: "b", AZURE_AD_TENANT_ID: "t" }).azure).toEqual({
      clientId: "a",
      clientSecret: "b",
      tenantId: "t",
    });
  });
  it("rôle par défaut", () => {
    expect(readAuthEnv({}).defaultRole).toBe("LECTURE");
    expect(readAuthEnv({ AUTH_DEFAULT_ROLE: "aucun" }).defaultRole).toBeNull();
  });
});

describe("parseDevLogin()", () => {
  it("accepte services généraux et lecture sans direction", () => {
    expect(parseDevLogin({ role: "SERVICES_GENERAUX" })).toMatchObject({ role: "SERVICES_GENERAUX", directionCode: null });
    expect(parseDevLogin({ role: "LECTURE", directionCode: "BEJI" })).toMatchObject({ role: "LECTURE", directionCode: null });
  });
  it("exige une direction connue pour directeur et manager", () => {
    expect(parseDevLogin({ role: "DIRECTEUR" })).toBeNull();
    expect(parseDevLogin({ role: "MANAGER", directionCode: "INCONNUE" })).toBeNull();
    expect(parseDevLogin({ role: "DIRECTEUR", directionCode: "BEJI" })).toMatchObject({
      role: "DIRECTEUR",
      directionCode: "BEJI",
      email: "dev-directeur-beji@prestigeplaces.local",
    });
  });
  it("refuse un rôle inconnu", () => {
    expect(parseDevLogin({ role: "ADMIN" })).toBeNull();
    expect(parseDevLogin(undefined)).toBeNull();
  });
});

describe("resolveRole()", () => {
  it("lit UserRole avec l'e-mail en minuscules", async () => {
    const find = vi.fn(async (email: string) =>
      email === "a.b@exemple.com" ? { role: "DIRECTEUR", directionCode: "AMINE" } : null,
    );
    await expect(resolveRole(" A.B@Exemple.com ", find, "LECTURE")).resolves.toEqual({ role: "DIRECTEUR", directionCode: "AMINE" });
  });
  it("applique le rôle par défaut ou refuse", async () => {
    const find = async () => null;
    await expect(resolveRole("x@y.z", find, "LECTURE")).resolves.toEqual({ role: "LECTURE", directionCode: null });
    await expect(resolveRole("x@y.z", find, null)).resolves.toBeNull();
    await expect(resolveRole(null, find, null)).resolves.toBeNull();
  });
});
