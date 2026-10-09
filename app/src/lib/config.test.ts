import { describe, expect, it } from "vitest";
import { parseConfig } from "./config";

describe("parseConfig", () => {
  it("applique les valeurs par défaut", () => {
    const c = parseConfig({});
    expect(c.DATABASE_URL).toBe("file:./dev.db");
    expect(c.DB_PROVIDER).toBe("sqlite");
    expect(c.authDevMode).toBe(false);
  });
  it("ignore les chaînes vides et refuse un provider inconnu", () => {
    expect(parseConfig({ AZURE_AD_CLIENT_ID: "" }).AZURE_AD_CLIENT_ID).toBeUndefined();
    expect(() => parseConfig({ DB_PROVIDER: "mysql" })).toThrow();
  });
});
