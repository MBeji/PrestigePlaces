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
type S = typeof import("@/lib/services");
let svc: S;
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

describe("proposal.run", () => {
  it("donne les quotas attendus et les mouvements sur la situation 7", async () => {
    user = { role: "SERVICES_GENERAUX" };
    const p = await svc.runProposal(baseId);
    expect(p.quota).toMatchObject({ AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217 });
    expect(p.kpis.changes).toBe(69);
    expect(p.movements.length).toBeGreaterThanOrEqual(69);
    expect(p.movements.filter((m) => m.to !== "VIDE" && m.from !== m.to).length).toBe(69);
    expect(p.kpis.floorsAfter.ZEINEB).toEqual(["2", "3"]);
    expect(p.name).toBe("Proposition de Situation 7 (classeur)");
    expect(p.status).toBe("PROPOSED");
    // le scénario source n'est pas modifié
    const src = await prisma.assignment.count({ where: { scenarioId: baseId } });
    expect(src).toBe(1137);
    // le résultat enregistré respecte les quotas
    const summary = await svc.getAssignmentSummary(p.scenarioId);
    expect(summary.byDirection).toMatchObject({ AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217, SUPPORT: 106 });
    expect(summary.zoneToFree).toBe(39);
  }, 60_000);

  it("est idempotent : un second calcul remplace la proposition", async () => {
    await svc.runProposal(baseId);
    const derived = await prisma.scenario.count({ where: { parentId: baseId } });
    expect(derived).toBe(1);
    const got = await svc.getProposal(baseId);
    expect(got.kpis.changes).toBe(69);
    expect(await prisma.auditLog.count({ where: { action: "PROPOSITION_CALCULEE" } })).toBe(2);
  }, 60_000);

  it("refuse le calcul à un rôle sans droit", async () => {
    user = { role: "MANAGER", directionCode: "BEJI" };
    await expect(svc.runProposal(baseId)).rejects.toMatchObject({ status: 403 });
    user = { role: "SERVICES_GENERAUX" };
  });
});

describe("scénarios et paramètres", () => {
  it("duplique, change de statut et journalise", async () => {
    user = { role: "SERVICES_GENERAUX" };
    const copy = await svc.duplicateScenario(baseId, { name: "Hypothèse A" });
    expect(copy.assignments).toBe(1137);
    const params = await svc.getDirectionParams(copy.id);
    expect(params.map((d) => d.cdi + d.externes + d.recrutements).reduce((a, b) => a + b, 0)).toBe(1334);
    await expect(svc.setScenarioStatus(copy.id, { status: "PUBLISHED" })).rejects.toMatchObject({ status: 409 });
    const s = await svc.setScenarioStatus(copy.id, { status: "PROPOSED" });
    expect(s.status).toBe("PROPOSED");
    user = { role: "DIRECTEUR", directionCode: "BEJI" };
    expect((await svc.setScenarioStatus(copy.id, { status: "VALIDATED" })).status).toBe("VALIDATED");
    expect(await prisma.auditLog.count({ where: { entity: "Scenario", entityId: copy.id } })).toBeGreaterThanOrEqual(3);
    user = { role: "SERVICES_GENERAUX" };
  });

  it("met à jour les paramètres d'une direction selon les droits, et verrouille les scénarios validés", async () => {
    const sc = await svc.createScenario({ name: "Hypothèse B" });
    user = { role: "DIRECTEUR", directionCode: "BEJI" };
    const up = await svc.updateDirectionParams(sc.id, "BEJI", { recrutements: 20 });
    expect(up.recrutements).toBe(20);
    await expect(svc.updateDirectionParams(sc.id, "AMMAR", { cdi: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(svc.updateDirectionParams(sc.id, "BEJI", { cdi: -1 })).rejects.toMatchObject({ status: 400 });
    user = { role: "SERVICES_GENERAUX" };
    const run = await svc.runProposal(sc.id);
    expect(run.targetHeadcount.BEJI).toBeGreaterThan(0);
    await svc.setScenarioStatus(sc.id, { status: "PROPOSED" });
    await svc.setScenarioStatus(sc.id, { status: "VALIDATED" });
    await expect(svc.updateDirectionParams(sc.id, "BEJI", { cdi: 5 })).rejects.toMatchObject({ status: 409 });
  }, 60_000);

  it("synchronise recrutements et externes avec les listes et applique la fenêtre des mails client", async () => {
    const sc = await svc.createScenario({ name: "Hypothèse C" });
    const before = (await svc.getDirectionParams(sc.id)).find((d) => d.directionCode === "AMINE")!;
    const base = before.recrutements;
    const r1 = await svc.addRecruitment(sc.id, { directionCode: "AMINE", count: 4, source: "SIRH", expectedDate: new Date() as never });
    const r2 = await svc.addRecruitment(sc.id, { directionCode: "AMINE", count: 3, source: "MAIL_CLIENT", expectedDate: new Date(Date.now() + 400 * 86400000) as never });
    const amine = r2.direction;
    expect(amine.recruitments.find((r) => r.id === r2.id)?.counted).toBe(false);
    expect(amine.recruitments.find((r) => r.id === r1.id)?.counted).toBe(true);
    // la somme reflète les lignes comptées (les lignes du classeur sont des SIRH)
    expect(amine.recrutements).toBe(amine.recruitments.filter((r) => r.counted).reduce((s, r) => s + r.count, 0));
    expect(amine.recrutements).toBeGreaterThanOrEqual(4);
    const after = await svc.removeRecruitment(sc.id, r1.id);
    expect(after.recrutements).toBe(amine.recrutements - 4);
    expect(base).toBeGreaterThanOrEqual(0);
    const ex = await svc.addExternal(sc.id, { directionCode: "AMINE", count: 2 });
    expect(ex.direction.externes).toBe(before.externes + 2);
  });

  it("règle réserve et zones à libérer", async () => {
    const sc = await svc.createScenario({ name: "Hypothèse D" });
    const p = await svc.updateScenarioParams(sc.id, { reservePct: 5 });
    expect(p.reservePct).toBe(5);
    await expect(svc.updateScenarioParams(sc.id, { reservePct: 80 })).rejects.toMatchObject({ status: 400 });
    const pos = await prisma.position.findFirstOrThrow({ where: { groupCode: "BLI", kind: "c" } });
    const z = await svc.setScenarioZones(sc.id, { positionIds: [pos.id] });
    expect(z.extraZones).toHaveLength(1);
    const run = await svc.runProposal(sc.id);
    expect(run.kpis.reserve).toBeGreaterThan(0);
    const plan = await svc.getFloorPlan("RDC", run.scenarioId);
    expect(plan.positions.length).toBeGreaterThan(0);
    expect(plan.positions.some((x) => x.directionCode === "ZONE_A_LIBERER")).toBe(true);
    await expect(svc.setScenarioZones(sc.id, { positionIds: ["inconnu"] })).rejects.toMatchObject({ status: 400 });
    // Ni position support ni poste fixe dans une zone à libérer.
    const sup = await prisma.position.findFirstOrThrow({ where: { groupCode: "SUP" } });
    await expect(svc.setScenarioZones(sc.id, { positionIds: [sup.id] })).rejects.toMatchObject({ status: 400 });
    const fixe = await prisma.position.findFirstOrThrow({ where: { kind: "m", groupCode: { notIn: ["SUP", "V", "FORMATION"] } } });
    await expect(svc.setScenarioZones(sc.id, { positionIds: [fixe.id] })).rejects.toMatchObject({ status: 400 });
  }, 60_000);

  it("liste les scénarios et les niveaux", async () => {
    expect((await svc.listScenarios()).length).toBeGreaterThan(3);
    expect((await svc.listFloors()).map((f) => f.code)).toEqual(["RDC", "1", "2", "3", "4"]);
    await expect(svc.getScenario("nope")).rejects.toMatchObject({ status: 404 });
  });
});
