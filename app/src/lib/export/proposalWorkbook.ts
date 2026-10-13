import * as XLSX from "xlsx";
import { DIRECTIONS } from "@/lib/directions";

/** Une position du site dans l'export : situation du scénario source et affectation proposée. */
export interface ExportPosition {
  floor: string;
  /** Numéro d'îlot affiché (1..n par niveau), null si la position n'appartient à aucun îlot. */
  island: number | null;
  r: number;
  c: number;
  kind: string;
  /** Équipe d'origine (groupe du plan, ex. BLI, AGAL, V, FORMATION). */
  groupCode: string;
  /** Direction actuelle dans le scénario source ("VIDE" si la position est libre). */
  current: string;
  /** Direction proposée ("VIDE" si la position est libérée ou non affectée). */
  proposed: string;
  zoneToFree: boolean;
}

export interface ProposalExportData {
  name: string;
  computedAt: string;
  quota: Record<string, number>;
  /** Nombre de positions qui changent de direction (indicateur de la proposition). */
  changes: number;
  /** Libellé des équipes par code de groupe. */
  teams: Record<string, string>;
  positions: ExportPosition[];
}

const VIDE = "VIDE";
const KIND_LABELS: Record<string, string> = { d: "Directeur", m: "Manager", c: "CDI", e: "Consultant externe" };
const DIR_LABEL: Record<string, string> = Object.fromEntries(DIRECTIONS.map((d) => [d.code, d.label]));
const dirLabel = (code: string) => (code === VIDE ? "Vide" : (DIR_LABEL[code] ?? code));

export function teamLabel(groupCode: string, teams: Record<string, string>): string {
  if (groupCode === "V") return "Vide";
  if (groupCode === "FORMATION") return "Formation";
  return teams[groupCode] ?? groupCode;
}

/** Statut d'une position dans la proposition. */
export function positionStatus(p: Pick<ExportPosition, "current" | "proposed" | "zoneToFree">): string {
  if (p.zoneToFree) return "Zone à libérer";
  if (p.current === "SUPPORT" || p.proposed === "SUPPORT") return "Support (hors équation)";
  if (p.current === p.proposed) return p.current === VIDE ? "Libre" : "Inchangée";
  if (p.proposed === VIDE) return "Libérée";
  if (p.current === VIDE) return "Attribuée";
  return "Change de direction";
}

/** Équipe après la proposition : l'équipe d'origine si la direction ne change pas, sinon à répartir dans la nouvelle direction. */
export function proposedTeam(p: ExportPosition, teams: Record<string, string>): string {
  if (p.proposed === VIDE || p.zoneToFree) return "";
  if (p.proposed === p.current) return teamLabel(p.groupCode, teams);
  return `À répartir (${dirLabel(p.proposed)})`;
}

function sheet(rows: (string | number)[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  if (rows.length > 1) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
  return ws;
}

/** Construit le classeur : une ligne par position, puis les récapitulatifs par direction et par équipe. */
export function buildProposalWorkbook(data: ProposalExportData): XLSX.WorkBook {
  const { positions, teams } = data;
  const wb = XLSX.utils.book_new();

  const posRows: (string | number)[][] = [
    ["Niveau", "Îlot", "Ligne", "Colonne", "Type", "Équipe d'origine", "Direction actuelle", "Direction proposée", "Équipe proposée", "Statut"],
    ...positions.map((p) => [
      p.floor, p.island ?? "", p.r, p.c, KIND_LABELS[p.kind] ?? p.kind, teamLabel(p.groupCode, teams),
      dirLabel(p.current), dirLabel(p.proposed), proposedTeam(p, teams), positionStatus(p),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(posRows, [8, 6, 6, 8, 18, 22, 18, 18, 24, 24]), "Positions");

  const dirCodes = DIRECTIONS.map((d) => d.code as string);
  const count = (pred: (p: ExportPosition) => boolean) => positions.filter(pred).length;
  const dirRows: (string | number)[][] = [
    ["Direction", "Positions actuelles", "Quota", "Positions proposées", "Écart", "Gagnées", "Cédées"],
    ...dirCodes.map((code) => {
      const current = count((p) => !p.zoneToFree && p.current === code);
      const proposed = count((p) => !p.zoneToFree && p.proposed === code);
      return [
        dirLabel(code), current, data.quota[code] ?? "", proposed, proposed - current,
        count((p) => !p.zoneToFree && p.proposed === code && p.current !== code),
        count((p) => !p.zoneToFree && p.current === code && p.proposed !== code),
      ];
    }),
  ];
  const free = count((p) => !p.zoneToFree && p.proposed === VIDE);
  dirRows.push(["Vide / réserve", count((p) => !p.zoneToFree && p.current === VIDE), "", free, free - count((p) => !p.zoneToFree && p.current === VIDE), "", ""]);
  dirRows.push(["Zone à libérer", count((p) => p.zoneToFree), "", count((p) => p.zoneToFree), 0, "", ""]);
  dirRows.push(["Total", positions.length, "", positions.length, 0, "", ""]);
  XLSX.utils.book_append_sheet(wb, sheet(dirRows, [18, 18, 8, 20, 8, 10, 10]), "Par direction");

  const groups = [...new Set(positions.map((p) => p.groupCode))].sort((a, b) => teamLabel(a, teams).localeCompare(teamLabel(b, teams), "fr"));
  const teamRows: (string | number)[][] = [
    ["Équipe", "Direction de l'équipe", "Positions actuelles", "Conservées", "Cédées à une autre direction", "Libérées"],
    ...groups.map((g) => {
      const own = positions.filter((p) => p.groupCode === g && !p.zoneToFree && p.current !== VIDE);
      return [
        teamLabel(g, teams), own.length ? dirLabel(own[0].current) : "", own.length,
        own.filter((p) => p.proposed === p.current).length,
        own.filter((p) => p.proposed !== p.current && p.proposed !== VIDE).length,
        own.filter((p) => p.proposed === VIDE).length,
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(teamRows, [24, 20, 18, 12, 26, 10]), "Par équipe");

  const info = XLSX.utils.aoa_to_sheet([
    ["Proposition", data.name],
    ["Calculée le", data.computedAt ? new Date(data.computedAt).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" }) : ""],
    ["Positions", positions.length],
    ["Changent de direction", data.changes],
  ]);
  info["!cols"] = [{ wch: 24 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, info, "Informations");
  return wb;
}

/** Classeur sérialisé au format .xlsx. */
export function proposalWorkbookBuffer(data: ProposalExportData): Buffer {
  return XLSX.write(buildProposalWorkbook(data), { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Nom de fichier ASCII : proposition-<scénario>-<aaaa-mm-jj>.xlsx */
export function exportFileName(name: string, date = new Date()): string {
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^Proposition de /i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `proposition-${slug || "scenario"}-${date.toISOString().slice(0, 10)}.xlsx`;
}
