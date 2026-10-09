import { describe, expect, it } from "vitest";
import { aggregate, parseCsv, parseHrFile, ImportError } from "@/lib/import/parse";
import { compareAggregates, paramsFromAggregate } from "@/lib/import/compare";
import { groupFromSplit } from "@/lib/import/groups";
import { hashMatricule } from "@/lib/import/hash";

const CSV = `Matricule;Nom;Prénom;BU;Grade;Directeur Split;Site
1001;Durand;Alice;BU1;D;AMMAR BLI;Tunis
1002;Martin;Bob;BU1;M;AMMAR CANOPE;Tunis
1003;Petit;Carl;BU1;C;AMMAR SN3;Tunis
1004;Roux;Dina;BU2;C;BOUBAKER;Tunis
1005;Blanc;Emma;BU3;C;ZEINEB;TUNIS
1006;Noir;Fred;BU3;C;BEJI OMEA;Tunis
1007;Gris;Gaby;BU3;M;BEJI PFS;Tunis
1008;Vert;Hugo;BU4;C;Direction Support;Tunis
1009;Bleu;Ines;BU4;C;AMINE;Paris
1001;Durand;Alice;BU1;D;AMMAR BLI;Tunis
1010;Rose;Jo;BU4;X;AMINE;Tunis
`;

describe("import RH", () => {
  it("calcule le groupe depuis Directeur Split", () => {
    expect(groupFromSplit("Ammar Autres")).toBe("AMMAR AUTRES");
    expect(groupFromSplit("Béji Autres")).toBe("BEJI AUTRES");
    expect(groupFromSplit("Quelque chose")).toBe("SUP");
  });

  it("gère les guillemets et le séparateur virgule", () => {
    expect(parseCsv('a,b\n"x,y",2\n')).toEqual([["a", "b"], ["x,y", "2"]]);
  });

  it("filtre le site, les doublons et les grades invalides", () => {
    const r = parseHrFile(Buffer.from(CSV), "rh.csv");
    expect(r.stats).toMatchObject({ lues: 11, retenues: 8, horsSite: 1, doublons: 1, invalides: 1 });
    const agg = aggregate(r.rows);
    expect(agg.BLI).toEqual({ d: 1, m: 1, c: 0 });
    expect(agg.SN3.c).toBe(1);
    expect(agg.AGAL.c).toBe(1);
    expect(agg.SUP.c).toBe(1);
    expect(agg.AMINE).toEqual({ d: 0, m: 0, c: 0 });
  });

  it("utilise la colonne code si elle est valide", () => {
    const csv = "Matricule,Grade,Directeur Split,Site,code\n1,C,ZEINEB,Tunis,AGAL\n";
    expect(parseHrFile(Buffer.from(csv), "x.csv").rows[0].group).toBe("AGAL");
  });

  it("refuse un fichier sans colonne obligatoire", () => {
    expect(() => parseHrFile(Buffer.from("Matricule;Nom\n1;A\n"), "x.csv")).toThrow(ImportError);
    expect(() => parseHrFile(Buffer.from("a"), "x.pdf")).toThrow(ImportError);
  });

  it("calcule entrées, sorties et paramètres", () => {
    const next = aggregate(parseHrFile(Buffer.from(CSV), "rh.csv").rows);
    const prev = structuredClone(next);
    prev.BLI = { d: 1, m: 0, c: 2 };
    const diff = compareAggregates(prev, next);
    const bli = diff.find((d) => d.group === "BLI")!;
    expect(bli).toMatchObject({ entrees: 1, sorties: 2, ecart: -1 });
    expect(compareAggregates(null, next).find((d) => d.group === "BLI")!.entrees).toBe(2);
    const p = paramsFromAggregate(next);
    expect(p.AMMAR).toEqual({ cdi: 3, fixedSeats: 2 });
    expect(p.BEJI).toEqual({ cdi: 2, fixedSeats: 1 });
    expect(p.SUPPORT).toBeUndefined();
  });

  it("hache le matricule avec le sel", () => {
    const h = hashMatricule("1001", "sel");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(hashMatricule("1001", "autre"));
    expect(h).not.toContain("1001");
  });
});
