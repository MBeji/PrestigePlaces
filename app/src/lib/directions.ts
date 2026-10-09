/** Directions du site de Tunis et correspondance groupe -> direction. */
export const DIRECTIONS = [
  { code: "AMMAR", label: "Ammar", color: "#2a78d6", inEquation: true },
  { code: "BOUBAKER", label: "Boubaker", color: "#eb6834", inEquation: true },
  { code: "ZEINEB", label: "Zeineb", color: "#1baf7a", inEquation: true },
  { code: "AMINE", label: "Amine", color: "#eda100", inEquation: true },
  { code: "BEJI", label: "Béji", color: "#e87ba4", inEquation: true },
  { code: "SUPPORT", label: "Support", color: "#6fa86f", inEquation: false },
] as const;

export const GROUP_DIRECTION: Record<string, string> = {
  BLI: "AMMAR",
  SN3: "AMMAR",
  "AMMAR AUTRES": "AMMAR",
  AGAL: "BOUBAKER",
  Z: "ZEINEB",
  AMINE: "AMINE",
  OMEA: "BEJI",
  PFS: "BEJI",
  "BEJI AUTRES": "BEJI",
  SUP: "SUPPORT",
};

export const FORMATION_GROUP = "FORMATION";
export const EMPTY_GROUP = "V";
