import { describe, expect, it } from "vitest";
import { ACTIONS, can, directionScope, type Action } from "@/lib/auth/permissions";

const sg = { user: { role: "SERVICES_GENERAUX", directionCode: null } };
const dirBeji = { user: { role: "DIRECTEUR", directionCode: "BEJI" } };
const mgrZeineb = { user: { role: "MANAGER", directionCode: "ZEINEB" } };
const lecture = { user: { role: "LECTURE", directionCode: null } };

describe("can() – services généraux", () => {
  it.each(ACTIONS)("autorise %s", (action) => {
    expect(can(sg, action)).toBe(true);
    expect(can(sg, action, { directionCode: "AMMAR" })).toBe(true);
  });
});

describe("can() – directeur", () => {
  it("lit tout et valide les scénarios", () => {
    expect(can(dirBeji, "lire")).toBe(true);
    expect(can(dirBeji, "scenario.valider")).toBe(true);
  });
  it("modifie les paramètres de sa direction seulement", () => {
    expect(can(dirBeji, "parametres.modifier", { directionCode: "BEJI" })).toBe(true);
    expect(can(dirBeji, "parametres.modifier", { directionCode: "AMMAR" })).toBe(false);
    expect(can(dirBeji, "parametres.modifier")).toBe(false);
  });
  it("ne gère ni scénarios, ni import, ni plans, ni présence", () => {
    const denied: Action[] = [
      "scenario.gerer",
      "scenario.publier",
      "proposition.calculer",
      "plans.modifier",
      "import",
      "utilisateurs.gerer",
    ];
    for (const a of denied) expect(can(dirBeji, a, { directionCode: "BEJI" })).toBe(false);
    expect(can(dirBeji, "presence.modifier", { directionCode: "BEJI" })).toBe(false);
  });
  it("sans direction rattachée, n'édite rien", () => {
    expect(can({ user: { role: "DIRECTEUR", directionCode: null } }, "parametres.modifier", { directionCode: "BEJI" })).toBe(false);
  });
});

describe("can() – manager", () => {
  it("lit et modifie la présence de sa direction seulement", () => {
    expect(can(mgrZeineb, "lire")).toBe(true);
    expect(can(mgrZeineb, "presence.modifier", { directionCode: "ZEINEB" })).toBe(true);
    expect(can(mgrZeineb, "presence.modifier", { directionCode: "AMINE" })).toBe(false);
  });
  it("ne modifie pas les paramètres et ne valide pas", () => {
    expect(can(mgrZeineb, "parametres.modifier", { directionCode: "ZEINEB" })).toBe(false);
    expect(can(mgrZeineb, "scenario.valider")).toBe(false);
  });
});

describe("can() – lecture et cas limites", () => {
  it("lecture seule", () => {
    for (const a of ACTIONS) expect(can(lecture, a, { directionCode: "AMMAR" })).toBe(a === "lire");
  });
  it("refuse sans session ou rôle inconnu", () => {
    expect(can(null, "lire")).toBe(false);
    expect(can(undefined, "lire")).toBe(false);
    expect(can({ user: null }, "lire")).toBe(false);
    expect(can({ user: { role: "ADMIN" } }, "lire")).toBe(false);
  });
});

describe("directionScope()", () => {
  it("donne la portée par rôle", () => {
    expect(directionScope(sg, "parametres.modifier")).toBe("toutes");
    expect(directionScope(dirBeji, "parametres.modifier")).toEqual(["BEJI"]);
    expect(directionScope(mgrZeineb, "parametres.modifier")).toEqual([]);
    expect(directionScope(mgrZeineb, "presence.modifier")).toEqual(["ZEINEB"]);
    expect(directionScope(lecture, "lire")).toBe("toutes");
    expect(directionScope(null, "lire")).toEqual([]);
  });
});
