import type { GROUP_CODES } from "./groups";

export type GroupCode = (typeof GROUP_CODES)[number];
export type Kind = "d" | "m" | "c";

export type KindCounts = { d: number; m: number; c: number };
export type Aggregate = Record<GroupCode, KindCounts>;

/** Ligne RH normalisée en mémoire (jamais renvoyée au navigateur). */
export type HrRow = { matricule: string; group: GroupCode; kind: Kind };

export type ParseStats = {
  /** Lignes de données lues (hors en-tête et lignes vides). */
  lues: number;
  /** Lignes retenues (site de Tunis, valides). */
  retenues: number;
  /** Lignes ignorées car hors du site de Tunis. */
  horsSite: number;
  /** Lignes invalides (matricule manquant, grade inconnu...). */
  invalides: number;
  /** Matricules en doublon (ligne ignorée). */
  doublons: number;
};

export type ParseResult = { rows: HrRow[]; stats: ParseStats; avertissements: string[] };

export type DiffRow = {
  group: GroupCode;
  direction: string;
  avant: KindCounts & { total: number };
  apres: KindCounts & { total: number };
  ecart: number;
  entrees: number;
  sorties: number;
};

export type ParamChange = {
  direction: string;
  cdiAvant: number | null;
  cdiApres: number;
  fixesAvant: number | null;
  fixesApres: number;
};

export type ImportPreview = {
  stats: ParseStats;
  avertissements: string[];
  aPrecedent: boolean;
  dateReference: string | null;
  diff: DiffRow[];
  totaux: { avant: number; apres: number; entrees: number; sorties: number };
  parametres: ParamChange[];
  scenarioId: string;
  scenarioNom: string;
  stockagePersonnes: boolean;
};
