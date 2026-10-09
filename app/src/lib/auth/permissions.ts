/**
 * Matrice des droits (module pur, sans dépendance à next-auth ni à Prisma).
 *
 * - SERVICES_GENERAUX : tout.
 * - DIRECTEUR : lecture globale, édition des paramètres de SA direction, validation des scénarios.
 * - MANAGER : lecture, taux de présence des équipes de SA direction.
 * - LECTURE : lecture seule.
 */

export const ROLES = ["SERVICES_GENERAUX", "DIRECTEUR", "MANAGER", "LECTURE"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  SERVICES_GENERAUX: "Services généraux",
  DIRECTEUR: "Directeur",
  MANAGER: "Manager",
  LECTURE: "Lecture seule",
};

/** Rôles rattachés à une direction (la direction est obligatoire). */
export const ROLES_WITH_DIRECTION: readonly AppRole[] = ["DIRECTEUR", "MANAGER"];

export const ACTIONS = [
  "lire",
  "parametres.modifier",
  "presence.modifier",
  "scenario.valider",
  "scenario.gerer",
  "scenario.publier",
  "proposition.calculer",
  "plans.modifier",
  "import",
  "utilisateurs.gerer",
] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_LABELS: Record<Action, string> = {
  lire: "Consulter les plans, paramètres et propositions",
  "parametres.modifier": "Modifier les paramètres d'une direction (CDI, externes, recrutements)",
  "presence.modifier": "Modifier les taux de présence des équipes",
  "scenario.valider": "Valider une proposition de scénario",
  "scenario.gerer": "Créer, dupliquer, activer ou supprimer un scénario, régler la réserve et les zones à libérer",
  "scenario.publier": "Publier un scénario validé",
  "proposition.calculer": "Lancer le calcul d'une proposition",
  "plans.modifier": "Modifier les plans et les positions",
  import: "Importer les fichiers RH et SIRH",
  "utilisateurs.gerer": "Gérer les rôles des utilisateurs",
};

/** Actions dont la portée dépend de la direction ciblée. */
export const DIRECTION_SCOPED_ACTIONS: readonly Action[] = ["parametres.modifier", "presence.modifier"];

export interface SessionUserLike {
  role?: string | null;
  directionCode?: string | null;
}
export type SessionLike = { user?: SessionUserLike | null } | null | undefined;

export interface PermissionContext {
  /** Direction concernée par l'action (obligatoire pour les actions à portée direction). */
  directionCode?: string | null;
}

export function isRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleOf(session: SessionLike): AppRole | null {
  const role = session?.user?.role;
  return isRole(role) ? role : null;
}

/** Actions autorisées sans condition de direction, par rôle. */
const GLOBAL: Record<AppRole, readonly Action[]> = {
  SERVICES_GENERAUX: ACTIONS,
  DIRECTEUR: ["lire", "scenario.valider"],
  MANAGER: ["lire"],
  LECTURE: ["lire"],
};

/** Actions autorisées uniquement sur la direction de l'utilisateur, par rôle. */
const OWN_DIRECTION: Record<AppRole, readonly Action[]> = {
  SERVICES_GENERAUX: [],
  DIRECTEUR: ["parametres.modifier"],
  MANAGER: ["presence.modifier"],
  LECTURE: [],
};

/**
 * Indique si la session peut réaliser l'action.
 * Pour une action à portée direction, `ctx.directionCode` désigne la direction ciblée ;
 * sans elle, seul un rôle à portée globale (services généraux) est autorisé.
 */
export function can(session: SessionLike, action: Action, ctx: PermissionContext = {}): boolean {
  const role = roleOf(session);
  if (!role) return false;
  if (GLOBAL[role].includes(action)) return true;
  if (!OWN_DIRECTION[role].includes(action)) return false;
  const own = session?.user?.directionCode;
  return !!own && !!ctx.directionCode && own === ctx.directionCode;
}

/**
 * Portée d'une action : "toutes" les directions, la liste des directions autorisées,
 * ou une liste vide si l'action est interdite. Pratique pour l'interface.
 */
export function directionScope(session: SessionLike, action: Action): "toutes" | string[] {
  const role = roleOf(session);
  if (!role) return [];
  if (GLOBAL[role].includes(action)) return "toutes";
  const own = session?.user?.directionCode;
  return OWN_DIRECTION[role].includes(action) && own ? [own] : [];
}
