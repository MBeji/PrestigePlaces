import * as XLSX from "xlsx";
import { GROUP_CODES, groupFromSplit, isGroupCode, normalizeText } from "./groups";
import type { Aggregate, HrRow, Kind, ParseResult } from "./types";

export class ImportError extends Error {}

const GRADES: Record<string, Kind> = { D: "d", M: "m", C: "c" };

/** Découpe un CSV (séparateur , ; ou tabulation détecté, guillemets gérés). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = [";", "\t", ","].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readTable(buffer: Buffer, filename: string): string[][] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(buffer.toString("utf8"));
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) throw new ImportError("Format non pris en charge : utilisez un fichier .xlsx ou .csv.");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new ImportError("Le classeur ne contient aucune feuille.");
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", blankrows: false });
  return data.map((r) => r.map((v) => String(v ?? "")));
}

function headerKey(h: string): string {
  return normalizeText(h).replace(/ /g, "");
}

/** Analyse une extraction RH (xlsx ou csv) et ne conserve que le site de Tunis. */
export function parseHrFile(buffer: Buffer, filename: string): ParseResult {
  const table = readTable(buffer, filename);
  const headerIdx = table.slice(0, 15).findIndex((r) => r.some((c) => headerKey(c) === "MATRICULE"));
  if (headerIdx < 0) throw new ImportError("En-tête introuvable : la colonne « Matricule » est obligatoire.");
  const idx = new Map<string, number>();
  table[headerIdx].forEach((h, i) => {
    const k = headerKey(h);
    if (k && !idx.has(k)) idx.set(k, i);
  });
  const col = (...names: string[]) => names.map((n) => idx.get(n)).find((v) => v !== undefined);
  const cMat = col("MATRICULE")!;
  const cGrade = col("GRADE");
  const cSplit = col("DIRECTEURSPLIT");
  const cCode = col("CODE", "CODEGROUPE");
  const cSite = col("SITE");
  const manquantes: string[] = [];
  if (cGrade === undefined) manquantes.push("Grade");
  if (cSite === undefined) manquantes.push("Site");
  if (cSplit === undefined && cCode === undefined) manquantes.push("Directeur Split (ou code)");
  if (manquantes.length) throw new ImportError(`Colonnes obligatoires manquantes : ${manquantes.join(", ")}.`);

  const stats = { lues: 0, retenues: 0, horsSite: 0, invalides: 0, doublons: 0 };
  const rows: HrRow[] = [];
  const seen = new Set<string>();
  for (const r of table.slice(headerIdx + 1)) {
    if (r.every((c) => c.trim() === "")) continue;
    stats.lues++;
    const get = (i: number | undefined) => (i === undefined ? "" : (r[i] ?? "").trim());
    if (!normalizeText(get(cSite)).includes("TUNIS")) {
      stats.horsSite++;
      continue;
    }
    const matricule = get(cMat);
    const kind = GRADES[normalizeText(get(cGrade)).charAt(0)];
    if (!matricule || !kind) {
      stats.invalides++;
      continue;
    }
    if (seen.has(matricule)) {
      stats.doublons++;
      continue;
    }
    seen.add(matricule);
    const codeCol = normalizeText(get(cCode));
    const group = isGroupCode(codeCol) ? codeCol : groupFromSplit(get(cSplit));
    rows.push({ matricule, group, kind });
    stats.retenues++;
  }
  const avertissements: string[] = [];
  if (stats.invalides) avertissements.push(`${stats.invalides} ligne(s) ignorée(s) : matricule manquant ou grade inconnu (D, M ou C attendu).`);
  if (stats.doublons) avertissements.push(`${stats.doublons} ligne(s) ignorée(s) : matricule en doublon.`);
  if (stats.horsSite) avertissements.push(`${stats.horsSite} ligne(s) hors du site de Tunis ignorée(s).`);
  if (!rows.length) throw new ImportError("Aucune ligne exploitable pour le site de Tunis.");
  return { rows, stats, avertissements };
}

export function aggregate(rows: HrRow[]): Aggregate {
  const agg = Object.fromEntries(GROUP_CODES.map((g) => [g, { d: 0, m: 0, c: 0 }])) as Aggregate;
  for (const r of rows) agg[r.group][r.kind]++;
  return agg;
}
