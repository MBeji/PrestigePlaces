import { getSession, can, type AppSession } from "@/lib/auth";
import { listScenarios, type ScenarioSummary } from "@/lib/services";

export interface ScenarioChoice {
  scenarios: ScenarioSummary[];
  selected: ScenarioSummary | null;
}

/** Scénarios « de travail » (hors propositions dérivées) et scénario retenu : paramètre d'URL, sinon actif, sinon le plus récent. */
export async function chooseScenario(requested?: string): Promise<ScenarioChoice> {
  const all = (await listScenarios()).filter((s) => s.parentId === null);
  const selected = all.find((s) => s.id === requested) ?? all.find((s) => s.isActive) ?? all[0] ?? null;
  return { scenarios: all, selected };
}

export interface Rights {
  gerer: boolean;
  valider: boolean;
  publier: boolean;
  calculer: boolean;
  /** Directions modifiables dans les paramètres. */
  editable: string[];
  role: string | null;
}

/** Droits de l'utilisateur courant, pour masquer ou désactiver les boutons (les services vérifient de toute façon). */
export function rightsOf(session: AppSession | null, directionCodes: string[]): Rights {
  return {
    gerer: can(session, "scenario.gerer"),
    valider: can(session, "scenario.valider"),
    publier: can(session, "scenario.publier"),
    calculer: can(session, "proposition.calculer"),
    editable: directionCodes.filter((c) => can(session, "parametres.modifier", { directionCode: c })),
    role: session?.user?.role ?? null,
  };
}

export async function currentRights(directionCodes: string[]): Promise<Rights> {
  return rightsOf(await getSession(), directionCodes);
}
