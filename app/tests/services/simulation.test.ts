import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sessionOf, setupTempDb, type FakeUser } from "./helpers";

let user: FakeUser = { role: "SERVICES_GENERAUX" };

vi.mock("@/lib/auth", async () => {
  const perms = await import("@/lib/auth/permissions");
  class AuthError extends Error {
    constructor(public status: 401 | 403, m: string) { super(m); }
  }
  return {
    AuthError,
    requirePermission: async (action: never, ctx: never) => {
      const s = sessionOf(user);
      if (!perms.can(s, action, ctx)) throw new AuthError(403, "Action non autorisée");
      return s;
    },
  };
});

let cleanup: () => void;
let svc: typeof import("@/lib/services");
let prisma: typeof import("@/lib/db").prisma;
let baseId: string;

beforeAll(async () => {
  cleanup = setupTempDb();
  svc = await import("@/lib/services");
  prisma = (await import("@/lib/db")).prisma;
  baseId = (await prisma.scenario.findFirstOrThrow({ where: { name: "Situation 7 (classeur)" } })).id;
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  cleanup?.();
});

describe("simulation", () => {
  it("calcule sans rien écrire, avec les quotas de référence", async () => {
    user = { role: "LECTURE" };
    const before = await prisma.scenario.count();
    const r = await svc.simulateScenario(baseId, { titre: "Référence" });
    expect(Object.fromEntries(r.rows.map((x) => [x.code, x.quotaAfter]))).toEqual({ AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217 });
    expect(r.kpis.changes).toBe(69);
    expect(await prisma.scenario.count()).toBe(before);
  });

  it("refuse des hypothèses invalides", async () => {
    await expect(svc.simulateScenario(baseId, { titre: "x", directions: [{ code: "SUPPORT", cdi: 1 }] })).rejects.toMatchObject({ status: 400 });
  });

  it("enregistre une simulation comme scénario brouillon, réservé aux droits de gestion", async () => {
    user = { role: "LECTURE" };
    const hypotheses = { titre: "AMINE +30", reservePct: 2, directions: [{ code: "AMINE" as const, recrutements: 30 }], niveauxALiberer: ["4" as const] };
    await expect(svc.saveSimulation(baseId, { name: "IA – test", hypotheses })).rejects.toMatchObject({ status: 403 });
    user = { role: "SERVICES_GENERAUX" };
    const saved = await svc.saveSimulation(baseId, { name: "IA – test", hypotheses });
    expect(saved.status).toBe("DRAFT");
    expect(saved.reservePct).toBe(2);
    const amine = (await svc.getDirectionParams(saved.id)).find((d) => d.directionCode === "AMINE")!;
    expect(amine.recrutements).toBe(30);
    expect((await svc.getScenarioParams(saved.id)).extraZones.length).toBeGreaterThan(0);
    // La simulation du scénario enregistré redonne les mêmes quotas.
    const again = await svc.simulateScenario(saved.id, { titre: "contrôle" });
    const direct = await svc.simulateScenario(baseId, hypotheses);
    expect(again.rows.map((r) => r.quotaAfter)).toEqual(direct.rows.map((r) => r.quotaAfter));
  });
});
