import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProposalTable from "./ProposalTable";
import CompareTable from "./CompareTable";
import MovementList from "./MovementList";

describe("rendu", () => {
  const data = {
    quota: { AMMAR: 204, BOUBAKER: 137, ZEINEB: 294, AMINE: 195, BEJI: 217 },
    current: { AMMAR: 251, BOUBAKER: 136, ZEINEB: 259, AMINE: 201, BEJI: 184 },
    targetHeadcount: { AMMAR: 250, BOUBAKER: 150, ZEINEB: 320, AMINE: 210, BEJI: 240 },
    floorsBefore: { ZEINEB: ["2"] },
    floorsAfter: { ZEINEB: ["2", "3"] },
    fixedSeats: { AMMAR: 14, BOUBAKER: 8, ZEINEB: 20, AMINE: 10, BEJI: 12 },
  };
  it("tableau de proposition : écarts, niveaux et taux", () => {
    const html = renderToStaticMarkup(createElement(ProposalTable, { data }));
    expect(html).toContain("+35");
    expect(html).toContain("−47");
    expect(html).toContain("2 → 2, 3");
    expect(html).toContain("80,5 %"); // 190 / 236
  });
  it("comparaison : colonne vide sans proposition", () => {
    const html = renderToStaticMarkup(createElement(CompareTable, { a: { name: "A", quota: data.quota, current: data.current }, b: { name: "B", quota: null, current: null } }));
    expect(html).toContain("204");
    expect(html).toContain("—");
  });
  it("liste de mouvements vide", () => {
    expect(renderToStaticMarkup(createElement(MovementList, { movements: [] }))).toContain("Aucun mouvement");
  });
});
