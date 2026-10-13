"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { simulateAction } from "@/app/scenarios-ia/actions";
import { DEFAULT_MODEL, DEFAULT_PROXY_URL, describeApiError, runAssistantTurn, type AssistantContext, type ChatMessage } from "@/lib/ai/assistant";
import { summarizeForAssistant, type SimulationInput, type SimulationResult } from "@/lib/simulation";
import type { DirectionStyle, FloorPlanData } from "@/components/plan/model";
import SimulationCard from "./SimulationCard";
import styles from "./ai.module.css";

const KEY_STORAGE = "prestigeplaces.ia.cle";
const MODEL_STORAGE = "prestigeplaces.ia.modele";
const URL_STORAGE = "prestigeplaces.ia.url";

const EXAMPLES = [
  "AMINE recrute 30 personnes de plus dans les 3 mois : qu'est-ce que ça change ?",
  "Garde 5 % de réserve et compare avec la situation actuelle.",
  "Et si on libérait entièrement le niveau 4 ?",
  "BEJI perd 20 consultants externes et ZEINEB en gagne 15.",
];

type ChatItem =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "assistant"; text: string }
  | { id: number; kind: "simulation"; input: SimulationInput; result: SimulationResult }
  | { id: number; kind: "error"; text: string };
type NewChatItem = ChatItem extends infer T ? (T extends ChatItem ? Omit<T, "id"> : never) : never;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée) : la clé reste en mémoire pour la session.
  }
}

export interface AiStudioProps {
  scenarioId: string;
  context: AssistantContext;
  floors: FloorPlanData[];
  directions: DirectionStyle[];
  canSave: boolean;
}

/** Saisie de la LLM Proxy Clé, de l'URL du proxy et du modèle, conversation avec l'assistant et scénarios calculés, dessinés sous chaque réponse. */
export default function AiStudio({ scenarioId, context, floors, directions, canSave }: AiStudioProps) {
  const [apiKey, setApiKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [remember, setRemember] = useState(true);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_PROXY_URL);
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState<null | "thinking" | "simulating">(null);
  const history = useRef<ChatMessage[]>([]);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Lecture après le montage : le stockage du navigateur n'existe pas au rendu serveur.
    const k = readStorage(KEY_STORAGE);
    const m = readStorage(MODEL_STORAGE);
    const u = readStorage(URL_STORAGE);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (k) setApiKey(k);
    if (m) setModel(m);
    if (u) setBaseUrl(u);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [items.length]);

  const push = (item: NewChatItem) => {
    const id = nextId.current++;
    setItems((cur) => [...cur, { ...item, id } as ChatItem]);
    return id;
  };

  function saveKey(e: FormEvent) {
    e.preventDefault();
    const k = keyDraft.trim();
    if (!k) return;
    setApiKey(k);
    setKeyDraft("");
    writeStorage(KEY_STORAGE, remember ? k : null);
  }
  function forgetKey() {
    setApiKey("");
    writeStorage(KEY_STORAGE, null);
  }
  function changeModel(m: string) {
    setModel(m);
    writeStorage(MODEL_STORAGE, m.trim() ? m : null);
  }
  function changeUrl(u: string) {
    setBaseUrl(u);
    writeStorage(URL_STORAGE, u.trim() ? u : null);
  }
  const ready = Boolean(apiKey && baseUrl.trim() && model.trim());
  function resetConversation() {
    history.current = [];
    setItems([]);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || !ready || busy) return;
    setPrompt("");
    push({ kind: "user", text: q });
    setBusy("thinking");
    const snapshot = history.current.length;
    history.current.push({ role: "user", content: q });
    let textId: number | null = null;
    try {
      await runAssistantTurn({ apiKey, baseUrl: baseUrl.trim(), model: model.trim() }, context, history.current, {
        onTextStart: () => {
          textId = push({ kind: "assistant", text: "" });
          setBusy("thinking");
        },
        onText: (delta) => {
          const id = textId;
          if (id === null) return;
          setItems((cur) => cur.map((it) => (it.id === id && it.kind === "assistant" ? { ...it, text: it.text + delta } : it)));
        },
        onToolStart: () => setBusy("simulating"),
        simulate: async (input) => {
          setBusy("simulating");
          const r = await simulateAction(scenarioId, input);
          if (!r.ok) throw new Error(r.error);
          push({ kind: "simulation", input: input as SimulationInput, result: r.data });
          setBusy("thinking");
          return { summary: summarizeForAssistant(r.data) };
        },
      });
    } catch (e) {
      // Tour interrompu : on retire ce tour de l'historique pour garder une conversation valide.
      history.current.length = snapshot;
      push({ kind: "error", text: describeApiError(e) });
    } finally {
      setItems((cur) => cur.filter((it) => !(it.kind === "assistant" && it.text === "")));
      setBusy(null);
    }
  }

  return (
    <div className={styles.studio}>
      <section className={`panel ${styles.keypanel}`} aria-labelledby="ia-cle">
        <h2 id="ia-cle">LLM Proxy Clé</h2>
        {apiKey ? (
          <div className={styles.keyrow}>
            <span className={styles.keyok}>Clé enregistrée sur ce navigateur ({apiKey.slice(0, 4)}…{apiKey.slice(-4)})</span>
            <button type="button" className={styles.btn} onClick={forgetKey}>Oublier la clé</button>
          </div>
        ) : (
          <form className={styles.keyrow} onSubmit={saveKey}>
            <input
              type="password" autoComplete="off" spellCheck={false} placeholder="Clé de votre fournisseur ou proxy LLM" aria-label="LLM Proxy Clé"
              value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className={styles.keyinput}
            />
            <label className={styles.inline}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Mémoriser sur ce navigateur
            </label>
            <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!keyDraft.trim()}>Utiliser cette clé</button>
          </form>
        )}
        <div className={styles.keyrow}>
          <label className={styles.inline}>
            URL du proxy
            <input
              type="url" spellCheck={false} value={baseUrl} onChange={(e) => changeUrl(e.target.value)} placeholder={DEFAULT_PROXY_URL}
              aria-label="URL du proxy" className={styles.keyinput}
            />
          </label>
          <label className={styles.inline}>
            Modèle
            <input
              type="text" spellCheck={false} value={model} onChange={(e) => changeModel(e.target.value)} placeholder={DEFAULT_MODEL}
              aria-label="Nom du modèle"
            />
          </label>
        </div>
        <p className={styles.note}>
          Fonctionne avec n&apos;importe quel fournisseur ou proxy LLM compatible avec le format OpenAI (<code>/chat/completions</code>,
          appel d&apos;outils) : indiquez son URL de base et le nom du modèle. La clé reste dans votre navigateur : elle part directement
          vers le proxy indiqué, jamais vers le serveur de l&apos;application ni dans la base. Seuls des chiffres agrégés (effectifs,
          positions par niveau) sont envoyés, aucune donnée nominative.
        </p>
      </section>

      <section className={`panel ${styles.chat}`} aria-labelledby="ia-conv" aria-busy={busy !== null}>
        <div className={styles.chathead}>
          <h2 id="ia-conv">Conversation</h2>
          {items.length > 0 && (
            <button type="button" className={`${styles.btn} ${styles.small}`} onClick={resetConversation} disabled={busy !== null}>Nouvelle conversation</button>
          )}
        </div>
        {items.length === 0 && (
          <div className={styles.empty}>
            <p>Exemples de demandes, à partir du scénario « {context.scenarioName} » :</p>
            <div className={styles.examples}>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className={styles.example} disabled={!ready || busy !== null} onClick={() => ask(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={styles.thread} aria-live="polite">
          {items.map((it) =>
            it.kind === "user" ? (
              <div key={it.id} className={styles.user}>{it.text}</div>
            ) : it.kind === "assistant" ? (
              <div key={it.id} className={styles.assistant}>{it.text}</div>
            ) : it.kind === "error" ? (
              <div key={it.id} className={styles.error} role="alert">{it.text}</div>
            ) : (
              <SimulationCard key={it.id} scenarioId={scenarioId} input={it.input} result={it.result} floors={floors} directions={directions} canSave={canSave} />
            ),
          )}
          {busy && <div className={styles.busy}>{busy === "simulating" ? "Calcul du scénario avec le moteur…" : "L'assistant réfléchit…"}</div>}
          <div ref={endRef} />
        </div>
        <form
          className={styles.ask}
          onSubmit={(e) => {
            e.preventDefault();
            void ask(prompt);
          }}
        >
          <textarea
            value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} aria-label="Votre demande"
            placeholder={ready ? "Ex. : et si BOUBAKER recrutait 25 personnes et qu'on gardait 3 % de réserve ?" : "Saisissez d'abord la LLM Proxy Clé, l'URL du proxy et le modèle."}
            disabled={!ready}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(prompt);
              }
            }}
          />
          <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!ready || !prompt.trim() || busy !== null}>
            Simuler
          </button>
        </form>
      </section>
    </div>
  );
}
