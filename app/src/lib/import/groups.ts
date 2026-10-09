import { GROUP_DIRECTION } from "@/lib/directions";

/** Groupes du site de Tunis (SUP = support, hors équation). */
export const GROUP_CODES = ["BLI", "SN3", "AMMAR AUTRES", "AGAL", "Z", "AMINE", "OMEA", "PFS", "BEJI AUTRES", "SUP"] as const;

export const SITE_CODE = "TUNIS";

export function isGroupCode(v: string): v is (typeof GROUP_CODES)[number] {
  return (GROUP_CODES as readonly string[]).includes(v);
}

export function directionOf(group: string): string {
  return GROUP_DIRECTION[group] ?? "SUPPORT";
}

/** Majuscules, sans accents, espaces et ponctuation normalisés. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Calcule le code de groupe à partir de la colonne « Directeur Split ». */
export function groupFromSplit(split: string): (typeof GROUP_CODES)[number] {
  const s = normalizeText(split);
  if (s === "AMMAR BLI" || s === "AMMAR CANOPE") return "BLI";
  if (s === "AMMAR SN3") return "SN3";
  if (s === "AMMAR AUTRES") return "AMMAR AUTRES";
  if (s === "BOUBAKER") return "AGAL";
  if (s === "ZEINEB") return "Z";
  if (s === "AMINE") return "AMINE";
  if (s === "BEJI OMEA") return "OMEA";
  if (s === "BEJI PFS") return "PFS";
  if (s === "BEJI AUTRES") return "BEJI AUTRES";
  return "SUP";
}
