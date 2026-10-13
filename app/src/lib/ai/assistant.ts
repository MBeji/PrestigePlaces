/**
 * Assistant des scénarios IA. L'appel à Claude part du navigateur avec la clé saisie par l'utilisateur : la clé ne
 * passe jamais par le serveur de l'application ni par la base. Le modèle décrit les hypothèses en appelant l'outil
 * `simuler_scenario` ; l'application calcule les chiffres avec le moteur de dispatching et les renvoie au modèle,
 * qui les commente. Seuls des agrégats (effectifs, positions par niveau) sont envoyés, aucune donnée nominative.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SIM_DIRECTIONS, SIM_FLOORS, type SimulationInput } from "@/lib/simulation";

export const AI_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (le plus capable)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (rapide)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (le plus rapide)" },
] as const;
export type AiModelId = (typeof AI_MODELS)[number]["id"];
export const DEFAULT_MODEL: AiModelId = "claude-opus-5-5";
export const isAiModel = (v: unknown): v is AiModelId => AI_MODELS.some((m) => m.id === v);

export const TOOL_NAME = "simuler_scenario";
/** Garde-fou : nombre maximal d'allers-retours modèle / outil par question. */
export const MAX_STEPS = 6;

/** Contexte du scénario de départ, envoyé au modèle (agrégats uniquement). */
export interface AssistantContext {
  scenarioName: string;
  reservePct: number;
  recruitWindowMonths: number;
  directions: { code: string; label: string; cdi: number; externes: number; recrutements: number; fixedSeats: number; current: number; quota: number }[];
  totals: { positions: number; support: number; zoneToFree: number; pool: number; allocated: number };
  /** Positions par niveau et par direction aujourd'hui (pool, hors support et zone de formation). */
  byFloor: Record<string, Record<string, number>>;
}

export const SIMULATION_TOOL: Anthropic.Beta.BetaTool = {
  name: TOOL_NAME,
  description:
    "Calcule un scénario de répartition des positions du site de Tunis avec le moteur de l'application, à partir d'hypothèses modifiées par rapport au scénario de départ. " +
    "Renvoie les quotas par direction avant et après, le nombre de positions qui changent de direction, les positions par niveau et la faisabilité. " +
    "Les valeurs sont absolues (nouvel effectif total, pas un écart). Ne mettre que ce qui change. Appeler une fois par scénario ; plusieurs appels pour comparer des variantes.",
  input_schema: {
    type: "object",
    properties: {
      titre: { type: "string", description: "Nom court du scénario, en français (ex. « AMINE +30 recrutements »)." },
      reservePct: { type: "number", minimum: 0, maximum: 50, description: "Réserve en pourcentage des positions à répartir, gardées libres." },
      directions: {
        type: "array",
        description: "Nouveaux effectifs des directions modifiées (valeurs absolues).",
        items: {
          type: "object",
          properties: {
            code: { type: "string", enum: [...SIM_DIRECTIONS] },
            cdi: { type: "integer", minimum: 0 },
            externes: { type: "integer", minimum: 0, description: "Consultants externes." },
            recrutements: { type: "integer", minimum: 0, description: "Recrutements retenus (SIRH ou mail client dans la fenêtre)." },
          },
          required: ["code"],
          additionalProperties: false,
        },
      },
      niveauxALiberer: {
        type: "array",
        description: "Niveaux entiers à libérer (sortis de la répartition). Le support et les postes fixes occupés y restent.",
        items: { type: "string", enum: [...SIM_FLOORS] },
      },
    },
    required: ["titre"],
    additionalProperties: false,
  },
};

const floorName = (f: string) => (f === "RDC" ? "RDC" : `niveau ${f}`);

/** Consigne système : règles métier figées et situation chiffrée du scénario de départ. */
export function buildSystemPrompt(ctx: AssistantContext): string {
  const dirs = ctx.directions
    .map((d) => `- ${d.code} (${d.label}) : ${d.cdi} CDI, ${d.externes} externes, ${d.recrutements} recrutements, effectif cible ${d.cdi + d.externes + d.recrutements}, ${d.fixedSeats} postes fixes, ${d.current} positions occupées aujourd'hui, quota actuel ${d.quota}`)
    .join("\n");
  const floors = Object.entries(ctx.byFloor)
    .map(([f, m]) => `- ${floorName(f)} : ${Object.entries(m).map(([d, n]) => `${d === "VIDE" ? "vides" : d} ${n}`).join(", ")}`)
    .join("\n");
  return `Tu es l'assistant de PrestigePlaces, l'application de dispatching des positions de travail du site Sofrecom de Tunis (5 niveaux : RDC, 1, 2, 3, 4).
Tu aides les directeurs et les services généraux à explorer des scénarios « et si… » en langage naturel. Réponds toujours en français, simplement, comme à un directeur.

Règles métier figées (ne jamais les changer) :
- Directions de l'équation : AMMAR, BOUBAKER, ZEINEB, AMINE, BEJI. Les fonctions support (SUPPORT) et leurs positions sont hors équation et ne bougent jamais.
- Effectif cible d'une direction = CDI + consultants externes + recrutements retenus (ouverts dans le SIRH, ou déclarés par le client par mail sur la fenêtre de ${ctx.recruitWindowMonths} mois).
- Quota = positions à répartir × effectif cible ÷ somme des effectifs cibles, arrondi au plus fort reste, jamais inférieur aux postes fixes. Positions à répartir = positions hors support et hors zones à libérer, moins la réserve.
- Les postes fixes (directeur, manager) ne changent jamais de direction. Le centre du RDC (salle de formation) n'est jamais affecté. Même hypothèse de télétravail pour toutes les équipes.

Scénario de départ : « ${ctx.scenarioName} », réserve ${ctx.reservePct} %.
Site : ${ctx.totals.positions} positions, dont ${ctx.totals.support} support, ${ctx.totals.zoneToFree} en zone à libérer ; ${ctx.totals.pool} positions dans la répartition, ${ctx.totals.allocated} réparties après réserve.
Directions :
${dirs}
Positions par niveau aujourd'hui :
${floors}

Méthode :
1. Traduis la demande en hypothèses et appelle l'outil ${TOOL_NAME}. Les valeurs sont absolues : pour « AMINE recrute 30 personnes de plus », calcule le nouveau total de recrutements à partir des chiffres ci-dessus. Pour comparer des variantes, appelle l'outil une fois par variante.
2. Ne donne jamais un chiffre que l'outil n'a pas calculé ou qui ne figure pas ci-dessus. Les graphiques et les plans du scénario s'affichent d'eux-mêmes sous ta réponse : ne les redessine pas.
3. Puis commente en 3 à 6 phrases courtes : ce qui change pour chaque direction concernée (quota avant → après), le nombre de positions qui changent de direction, les niveaux touchés, et un point d'attention si la répartition par niveau n'est pas réalisable ou si un quota est bloqué par les postes fixes.
4. Si la demande sort des règles (déplacer le support, affecter la salle de formation, changer la règle d'équité), explique pourquoi en une phrase et propose l'hypothèse la plus proche qui respecte les règles.
5. Si la demande est ambiguë, choisis l'interprétation la plus raisonnable, dis laquelle, et calcule.`;
}

export interface SimulationOutcome {
  /** Résumé chiffré renvoyé au modèle. */
  summary: unknown;
}

export interface AssistantCallbacks {
  /** Début d'un nouveau bloc de texte de l'assistant. */
  onTextStart: () => void;
  onText: (delta: string) => void;
  /** Exécute une simulation demandée par le modèle (appel au serveur de l'application). */
  simulate: (input: SimulationInput | unknown) => Promise<SimulationOutcome>;
  /** Le modèle est en train de préparer un appel d'outil. */
  onToolStart?: () => void;
}

/** Message d'erreur lisible pour une erreur de l'API Claude. */
export function describeApiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Clé API refusée : vérifiez la clé saisie.";
  if (e instanceof Anthropic.PermissionDeniedError) return "Cette clé n'a pas accès au modèle choisi. Essayez un autre modèle.";
  if (e instanceof Anthropic.NotFoundError) return "Modèle introuvable pour cette clé. Essayez un autre modèle.";
  if (e instanceof Anthropic.RateLimitError) return "Limite de débit atteinte sur cette clé : réessayez dans un instant.";
  if (e instanceof Anthropic.BadRequestError) return `Requête refusée par l'API : ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return "Impossible de joindre l'API Claude depuis ce navigateur (réseau ou pare-feu).";
  if (e instanceof Anthropic.APIError) return `Erreur de l'API Claude (${e.status ?? "?"}) : ${e.message}`;
  return e instanceof Error ? e.message : "Erreur inattendue.";
}

/**
 * Un tour de conversation : envoie l'historique, diffuse le texte en temps réel, exécute les simulations demandées
 * et relance le modèle avec leurs résultats jusqu'à sa réponse finale. `history` est complété sur place (ajout
 * seulement, jamais de réécriture des tours passés) pour garder la conversation entre deux questions.
 */
export async function runAssistantTurn(
  client: Anthropic,
  model: AiModelId,
  ctx: AssistantContext,
  history: Anthropic.Beta.BetaMessageParam[],
  cb: AssistantCallbacks,
): Promise<void> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: buildSystemPrompt(ctx), cache_control: { type: "ephemeral" } }];
  for (let step = 0; step < MAX_STEPS; step++) {
    // Repli automatique côté serveur si le modèle décline (Opus et Sonnet sur l'API Claude).
    const fallback = model === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      system,
      tools: [SIMULATION_TOOL],
      tool_choice: { type: "auto" },
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: history,
      ...fallback,
    });
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") cb.onTextStart();
        else if (event.content_block.type === "tool_use") cb.onToolStart?.();
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        cb.onText(event.delta.text);
      }
    });
    const message = await stream.finalMessage();
    history.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });

    if (message.stop_reason === "refusal") throw new Error("Le modèle a décliné cette demande. Reformulez-la autour des places et des effectifs.");
    if (message.stop_reason === "max_tokens") throw new Error("Réponse interrompue (longueur maximale atteinte). Posez une question plus ciblée.");
    if (message.stop_reason !== "tool_use") return;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      if (block.name !== TOOL_NAME) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Outil inconnu : ${block.name}`, is_error: true });
        continue;
      }
      try {
        const { summary } = await cb.simulate(block.input);
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(summary) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: e instanceof Error ? e.message : "Simulation impossible.", is_error: true });
      }
    }
    history.push({ role: "user", content: results });
  }
  throw new Error("L'assistant a enchaîné trop de simulations : reformulez la demande en une ou deux variantes.");
}
