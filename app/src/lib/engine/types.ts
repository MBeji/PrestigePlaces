/**
 * Types du moteur de dispatching (pur TypeScript, sans dépendance à Prisma ni au DOM).
 */

/** Code de direction réservé aux positions vides (non affectées). */
export const VIDE = "VIDE";
/** Code de la direction support, hors équation : ses positions ne bougent jamais. */
export const SUPPORT = "SUPPORT";
/** Groupe des positions de la zone à libérer (centre du RDC, future salle de formation). */
export const FORMATION = "FORMATION";
/** Ordre par défaut des niveaux du site de Tunis. */
export const DEFAULT_FLOORS = ["RDC", "1", "2", "3", "4"] as const;

/** Grade porté par une position : directeur, manager, collaborateur, externe. */
export type SeatKind = "d" | "m" | "c" | "e";

/** Une position de travail (siège) telle que la voit le moteur. */
export interface Seat {
  /** Identifiant stable (ex. `RDC:6:21` depuis situation.json, ou l'id Prisma de la Position). */
  id: string;
  /** Code du niveau : RDC, 1, 2, 3, 4. */
  floor: string;
  r: number;
  c: number;
  /** Code du groupe (BLI, SN3, ..., SUP, V, FORMATION). */
  groupCode: string;
  kind: SeatKind;
  /** Direction actuelle : code de direction, SUPPORT ou VIDE. */
  direction: string;
  /** Poste fixe (directeur ou manager) : occupé, il ne change jamais de direction ; vide, il peut être repris (comme dans le prototype). */
  fixed: boolean;
  /** Position d'une zone à libérer : jamais affectée, hors du pool. */
  zoneToFree: boolean;
  /** Poste réservé (équipement, accessibilité) : ne change pas de direction. Optionnel. */
  reserved?: boolean;
  /** Numéro d'îlot (1..n par niveau). Calculé par le moteur s'il est absent. */
  island?: number;
}

/** Paramètres d'une direction pour un scénario. */
export interface DirectionParam {
  code: string;
  cdi: number;
  externes: number;
  recrutements: number;
  /** Postes fixes (directeur + managers) : plancher du quota. */
  fixedSeats: number;
}

export interface QuotaInput {
  directions: DirectionParam[];
  /** Positions du pool avant réserve (hors SUPPORT et hors zones à libérer, vides comprises). */
  positionsToAllocate: number;
  /** Réserve en pourcentage du pool (0 par défaut). */
  reservePct?: number;
}

export interface QuotaResult {
  /** Quota par direction (≥ postes fixes). */
  quotas: Record<string, number>;
  /** Effectif cible par direction : CDI + externes + recrutements. */
  targetHeadcount: Record<string, number>;
  /** Somme des effectifs cibles. */
  totalTargetHeadcount: number;
  /** Taux commun : alloc / somme des effectifs cibles (0 si effectif nul). */
  rate: number;
  /** Positions effectivement réparties : pool − réserve. */
  alloc: number;
  /** Positions gardées libres : round(pool × réserve %). */
  reserve: number;
}

export interface ProposeOptions {
  /** Réserve en pourcentage du pool (0 par défaut). */
  reservePct?: number;
  /** Ordre des niveaux (défaut RDC, 1, 2, 3, 4, puis les autres niveaux rencontrés). */
  floors?: string[];
  /** Identifiants de positions supplémentaires à traiter comme zones à libérer. */
  extraZoneToFree?: Iterable<string>;
  /** Nombre maximal de nouveaux niveaux candidats examinés par direction déficitaire (4 par défaut). */
  maxNewFloorCandidates?: number;
}

export interface Movement {
  seatId: string;
  floor: string;
  island: number;
  from: string;
  to: string;
}

export interface ProposalKpis {
  /** Positions réparties (pool − réserve). */
  positionsToAllocate: number;
  /** Positions gardées en réserve. */
  reserve: number;
  /** Somme des effectifs cibles. */
  targetHeadcount: number;
  /** Taux commun. */
  rate: number;
  /** Positions qui changent de direction (hors libérations vers VIDE). */
  changes: number;
  /** Niveaux occupés par direction avant la proposition. */
  floorsBefore: Record<string, string[]>;
  /** Niveaux occupés par direction après la proposition. */
  floorsAfter: Record<string, string[]>;
}

export interface Proposal {
  quota: Record<string, number>;
  current: Record<string, number>;
  delta: Record<string, number>;
  targetHeadcount: Record<string, number>;
  /** Direction proposée pour chaque position (toutes les positions, y compris SUPPORT et zones à libérer). */
  proposed: Map<string, string>;
  /** Positions dont la direction change (y compris les libérations vers VIDE), triées par niveau, îlot, ligne, colonne. */
  movements: Movement[];
  /** Îlot de chaque position. */
  islands: Map<string, number>;
  /** Répartition par niveau retenue : positions libérées et gagnées par `direction|niveau`. */
  floorPlan: { release: Record<string, number>; gain: Record<string, number>; toReserve: Record<string, number>; feasible: boolean };
  kpis: ProposalKpis;
}
