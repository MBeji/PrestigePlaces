/**
 * Assistant des scénarios IA. L'appel au LLM part du navigateur avec la « LLM Proxy Clé » saisie par l'utilisateur,
 * vers un point d'accès compatible OpenAI (`/chat/completions`) : n'importe quel fournisseur ou proxy LLM qui expose
 * ce format convient. La clé ne passe jamais par le serveur de l'application ni par la base. Le modèle décrit les
 * hypothèses en appelant l'outil `simuler_scenario` ; l'application calcule les chiffres avec le moteur de dispatching
 * et les renvoie au modèle, qui les commente. Seuls des agrégats (effectifs, positions par niveau) sont envoyés.
 */
import { SIM_DIRECTIONS, SIM_FLOORS, type SimulationInput } from "@/lib/simulation";

/** URL de base par défaut (format compatible OpenAI), modifiable dans la page. */
export const DEFAULT_PROXY_URL = "https://api.openai.com/v1";
/** Nom de modèle par défaut, champ libre dans la page. */
export const DEFAULT_MODEL = "gpt-4o";

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

/** Outil de simulation au format « function calling » compatible OpenAI. */
export const SIMULATION_TOOL = {
  type: "function",
  function: {
    name: TOOL_NAME,
    description:
      "Calcule un scénario de répartition des positions du site de Tunis avec le moteur de l'application, à partir d'hypothèses modifiées par rapport au scénario de départ. " +
      "Renvoie les quotas par direction avant et après, le nombre de positions qui changent de direction, les positions par niveau et la faisabilité. " +
      "Les valeurs sont absolues (nouvel effectif total, pas un écart). Ne mettre que ce qui change. Appeler une fois par scénario ; plusieurs appels pour comparer des variantes.",
    parameters: {
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
  },
} as const;

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


/** Paramètres de connexion saisis dans la page, conservés dans le navigateur uniquement. */
export interface LlmConfig {
  apiKey: string;
  /** URL de base du proxy, sans `/chat/completions` (ex. https://mon-proxy/v1). */
  baseUrl: string;
  model: string;
}

/** Appel d'outil demandé par le modèle. */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Message de conversation au format compatible OpenAI. */
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

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

/** Erreur HTTP renvoyée par le proxy LLM. */
export class LlmHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "LlmHttpError";
  }
}

/** Point d'accès des complétions à partir de l'URL saisie (avec ou sans `/chat/completions`). */
export function completionsUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(u) ? u : `${u}/chat/completions`;
}

/** Message d'erreur lisible pour une erreur du proxy LLM. */
export function describeApiError(e: unknown): string {
  if (e instanceof LlmHttpError) {
    if (e.status === 401) return "LLM Proxy Clé refusée : vérifiez la clé saisie.";
    if (e.status === 403) return "Cette clé n'a pas accès au modèle choisi. Essayez un autre modèle.";
    if (e.status === 404) return "Modèle ou URL du proxy introuvable : vérifiez l'URL et le nom du modèle.";
    if (e.status === 429) return "Limite de débit atteinte sur cette clé : réessayez dans un instant.";
    if (e.status === 400) return `Requête refusée par le proxy LLM : ${e.message}`;
    return `Erreur du proxy LLM (${e.status}) : ${e.message}`;
  }
  if (e instanceof TypeError) return "Impossible de joindre le proxy LLM depuis ce navigateur (URL, réseau, pare-feu ou CORS).";
  return e instanceof Error ? e.message : "Erreur inattendue.";
}

interface Completion {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

async function readError(res: Response): Promise<LlmHttpError> {
  let msg = res.statusText || "réponse inattendue";
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      msg = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? text;
    } catch {
      if (text) msg = text;
    }
  } catch {
    // Corps illisible : on garde le statut.
  }
  return new LlmHttpError(res.status, msg.slice(0, 300));
}

type Delta = { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] };

/** Envoie une requête de complétion en flux (SSE) ; accepte aussi une réponse JSON complète. */
async function complete(cfg: LlmConfig, messages: ChatMessage[], cb: AssistantCallbacks, signal?: AbortSignal): Promise<Completion> {
  const res = await fetch(completionsUrl(cfg.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, tools: [SIMULATION_TOOL], tool_choice: "auto", stream: true }),
    signal,
  });
  if (!res.ok) throw await readError(res);

  const out: Completion = { content: "", toolCalls: [], finishReason: null };
  let textStarted = false;
  const onDelta = (d: Delta | undefined) => {
    if (!d) return;
    if (d.content) {
      if (!textStarted) {
        textStarted = true;
        cb.onTextStart();
      }
      out.content += d.content;
      cb.onText(d.content);
    }
    for (const tc of d.tool_calls ?? []) {
      const i = tc.index ?? out.toolCalls.length;
      if (!out.toolCalls[i]) {
        out.toolCalls[i] = { id: tc.id ?? `appel_${i}`, type: "function", function: { name: "", arguments: "" } };
        cb.onToolStart?.();
      }
      const cur = out.toolCalls[i];
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.function.name += tc.function.name;
      if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
    }
  };

  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream") || !res.body) {
    // Proxy sans flux : réponse JSON complète.
    const j = (await res.json()) as { choices?: { message?: Delta; finish_reason?: string | null }[] };
    const c = j.choices?.[0];
    onDelta(c?.message);
    out.finishReason = c?.finish_reason ?? null;
  } else {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      buf += decoder.decode(value, { stream: !done });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let chunk: { choices?: { delta?: Delta; finish_reason?: string | null }[]; error?: { message?: string } };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        if (chunk.error) throw new LlmHttpError(500, chunk.error.message ?? "erreur dans le flux");
        const c = chunk.choices?.[0];
        onDelta(c?.delta);
        if (c?.finish_reason) out.finishReason = c.finish_reason;
      }
      if (done) break;
    }
  }
  out.toolCalls = out.toolCalls.filter(Boolean);
  return out;
}

/**
 * Un tour de conversation : envoie l'historique, diffuse le texte en temps réel, exécute les simulations demandées
 * et relance le modèle avec leurs résultats jusqu'à sa réponse finale. `history` est complété sur place (ajout
 * seulement, jamais de réécriture des tours passés) pour garder la conversation entre deux questions.
 */
export async function runAssistantTurn(
  cfg: LlmConfig,
  ctx: AssistantContext,
  history: ChatMessage[],
  cb: AssistantCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const system: ChatMessage = { role: "system", content: buildSystemPrompt(ctx) };
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await complete(cfg, [system, ...history], cb, signal);
    history.push({ role: "assistant", content: r.content || null, ...(r.toolCalls.length ? { tool_calls: r.toolCalls } : {}) });

    if (r.finishReason === "content_filter") throw new Error("Le modèle a décliné cette demande. Reformulez-la autour des places et des effectifs.");
    if (r.finishReason === "length") throw new Error("Réponse interrompue (longueur maximale atteinte). Posez une question plus ciblée.");
    if (r.toolCalls.length === 0) return;

    for (const call of r.toolCalls) {
      if (call.function.name !== TOOL_NAME) {
        history.push({ role: "tool", tool_call_id: call.id, content: `Outil inconnu : ${call.function.name}` });
        continue;
      }
      try {
        const input: unknown = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const { summary } = await cb.simulate(input);
        history.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(summary) });
      } catch (e) {
        history.push({ role: "tool", tool_call_id: call.id, content: `Erreur : ${e instanceof Error ? e.message : "simulation impossible."}` });
      }
    }
  }
  throw new Error("L'assistant a enchaîné trop de simulations : reformulez la demande en une ou deux variantes.");
}
