"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveSimulationAction } from "@/app/scenarios-ia/actions";
import PlanSvg from "@/components/plan/PlanSvg";
import { directionColor, directionLabel, VIDE, type DirectionStyle, type FloorPlanData, type PlanView } from "@/components/plan/model";
import { signed } from "@/components/params/format";
import type { SimulationInput, SimulationResult } from "@/lib/simulation";
import styles from "./ai.module.css";

export interface SimulationCardProps {
  scenarioId: string;
  input: SimulationInput;
  result: SimulationResult;
  floors: FloorPlanData[];
  directions: DirectionStyle[];
  canSave: boolean;
}

const per100 = (rate: number) => (rate * 100).toFixed(1).replace(".", ",");
const tone = (n: number) => (n > 0 ? styles.gain : n < 0 ? styles.loss : styles.neutral);

/** Plans des niveaux avec la direction simulée de chaque position (format attendu par PlanSvg). */
export function simulatedFloors(floors: readonly FloorPlanData[], result: SimulationResult): FloorPlanData[] {
  const extra = new Set(result.extraZoneIds);
  return floors.map((f) => ({
    ...f,
    positions: f.positions.map((p) => ({ ...p, extraZone: p.extraZone || extra.has(p.id), proposed: result.changed[p.id] ?? p.current })),
  }));
}

/** Scénario calculé : chiffres clés, quotas avant / après, positions par niveau et plans dessinés. */
export default function SimulationCard({ scenarioId, input, result, floors, directions, canSave }: SimulationCardProps) {
  const planFloors = useMemo(() => simulatedFloors(floors, result), [floors, result]);
  const touched = useMemo(() => {
    const changedByFloor = new Map<string, number>();
    for (const f of planFloors) changedByFloor.set(f.code, f.positions.filter((p) => !p.zoneToFree && p.proposed !== p.current).length);
    return changedByFloor;
  }, [planFloors]);
  const [floorCode, setFloorCode] = useState(() => [...touched.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? floors[0]?.code ?? "");
  const [view, setView] = useState<PlanView>("changements");
  const floor = planFloors.find((f) => f.code === floorCode) ?? planFloors[0];
  const k = result.kpis;
  const max = Math.max(1, ...result.rows.flatMap((r) => [r.quotaBefore, r.quotaAfter, r.current]));
  const dirCodes = result.rows.map((r) => r.code);
  const floorCodes = floors.map((f) => f.code);
  const labelOf = new Map(floors.map((f) => [f.code, f.label]));
  const floorName = (code: string) => labelOf.get(code) ?? code;

  return (
    <article className={styles.card} aria-label={`Scénario ${result.titre}`}>
      <header className={styles.cardhead}>
        <h3>{result.titre}</h3>
        <ul className={styles.hyps}>
          {result.hypotheses.length ? result.hypotheses.map((h) => <li key={h}>{h}</li>) : <li>Hypothèses du scénario de départ</li>}
        </ul>
      </header>

      <div className="kpis" style={{ marginBottom: 0 }}>
        <div className="kpi"><div className="l">Changent de direction</div><div className="v">{k.changes}</div></div>
        <div className="kpi">
          <div className="l">Positions à répartir</div>
          <div className="v">{k.positionsToAllocate}</div>
          <Delta before={k.positionsToAllocateBefore} after={k.positionsToAllocate} />
        </div>
        <div className="kpi">
          <div className="l">Effectif cible</div>
          <div className="v">{k.targetHeadcount}</div>
          <Delta before={k.targetHeadcountBefore} after={k.targetHeadcount} />
        </div>
        <div className="kpi">
          <div className="l">Positions pour 100 pers.</div>
          <div className="v">{per100(k.rate)}</div>
          <div className={styles.kpisub}>avant {per100(k.rateBefore)}</div>
        </div>
        <div className="kpi">
          <div className="l">Réserve</div>
          <div className="v">{k.reserve}</div>
          <div className={styles.kpisub}>{result.reservePct} % des positions</div>
        </div>
      </div>

      {!k.feasible && <p role="alert" className={styles.warn}>La répartition par niveau n&apos;est pas entièrement réalisable avec ces hypothèses : certains quotas ne sont pas atteints.</p>}
      {result.freedPositions > 0 && (
        <p className={styles.kpisub}>{result.freedPositions} positions libérées sur {result.niveauxALiberer.map(floorName).join(", ")} (support et postes fixes occupés restent en place).</p>
      )}

      <section aria-label="Quotas par direction">
        <h4>Quotas par direction</h4>
        <div className={styles.legend}>
          <span><i className={styles.lgBefore} /> quota avant</span>
          <span><i className={styles.lgAfter} /> quota simulé</span>
          <span><i className={styles.lgNow} /> positions occupées aujourd&apos;hui</span>
        </div>
        <div className={styles.bars}>
          {result.rows.map((r) => {
            const color = directionColor(r.code, directions);
            const d = r.quotaAfter - r.quotaBefore;
            return (
              <div key={r.code} className={styles.barrow}>
                <span className={styles.barname}><i className="sw" style={{ background: color }} />{directionLabel(r.code, directions)}</span>
                <div className={styles.bartrack} role="img" aria-label={`${r.code} : quota ${r.quotaBefore} avant, ${r.quotaAfter} simulé, ${r.current} occupées aujourd'hui`}>
                  <div className={styles.barbefore} style={{ width: `${(r.quotaBefore / max) * 100}%`, background: color }} />
                  <div className={styles.barafter} style={{ width: `${(r.quotaAfter / max) * 100}%`, background: color }} />
                  <div className={styles.barnow} style={{ left: `${(r.current / max) * 100}%` }} />
                </div>
                <span className={styles.barval}>
                  {r.quotaBefore} → <strong>{r.quotaAfter}</strong> <span className={tone(d)}>{signed(d)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <details className={styles.details}>
        <summary>Détail par direction</summary>
        <div className={styles.tablewrap}>
          <table>
            <thead>
              <tr>
                <th>Direction</th><th className="num">CDI</th><th className="num">Externes</th><th className="num">Recrutements</th>
                <th className="num">Effectif cible</th><th className="num">Postes fixes</th><th className="num">Occupées</th>
                <th className="num">Quota avant</th><th className="num">Quota simulé</th><th className="num">Écart / aujourd&apos;hui</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.code}>
                  <td>{directionLabel(r.code, directions)}</td>
                  <td className="num">{r.cdi}</td><td className="num">{r.externes}</td><td className="num">{r.recrutements}</td>
                  <td className="num">{r.targetBefore === r.targetAfter ? r.targetAfter : `${r.targetBefore} → ${r.targetAfter}`}</td>
                  <td className="num">{r.fixedSeats}</td><td className="num">{r.current}</td>
                  <td className="num">{r.quotaBefore}</td><td className="num"><strong>{r.quotaAfter}</strong></td>
                  <td className={`num ${tone(r.quotaAfter - r.current)}`}>{signed(r.quotaAfter - r.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <section aria-label="Positions par niveau">
        <h4>Positions par niveau après le scénario</h4>
        <div className={styles.tablewrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th>Niveau</th>
                {dirCodes.map((c) => <th key={c} className="num">{directionLabel(c, directions)}</th>)}
                <th className="num">Vides</th>
              </tr>
            </thead>
            <tbody>
              {floorCodes.map((f) => (
                <tr key={f}>
                  <td>{floorName(f)}</td>
                  {[...dirCodes, VIDE].map((c) => {
                    const after = result.floorsAfter[f]?.[c] ?? 0;
                    const d = after - (result.floorsBefore[f]?.[c] ?? 0);
                    return (
                      <td key={c} className="num" style={after && c !== VIDE ? { background: `color-mix(in srgb, ${directionColor(c, directions)} ${Math.min(45, 8 + after / 3)}%, transparent)` } : undefined}>
                        {after || "·"}{d !== 0 && <span className={`${styles.cellDelta} ${c === VIDE ? styles.neutral : tone(d)}`}> {signed(d)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {floor && (
        <section aria-label="Plans du scénario">
          <h4>Plans du scénario</h4>
          <div className={styles.planbar}>
            <div role="tablist" aria-label="Niveau" className={styles.tabs}>
              {planFloors.map((f) => (
                <button
                  key={f.code} type="button" role="tab" aria-selected={f.code === floor.code}
                  className={f.code === floor.code ? styles.tabOn : styles.tab} onClick={() => setFloorCode(f.code)}
                >
                  {floorName(f.code)}{touched.get(f.code) ? <span className={styles.tabCount}>{touched.get(f.code)}</span> : null}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="Vue" className={styles.tabs}>
              {(["situation", "proposition", "changements"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? styles.tabOn : styles.tab} onClick={() => setView(v)}>
                  {v === "situation" ? "Aujourd'hui" : v === "proposition" ? "Scénario" : "Changements"}
                </button>
              ))}
            </div>
          </div>
          <PlanSvg data={floor} view={view} directions={directions} />
        </section>
      )}

      <SaveBar scenarioId={scenarioId} input={input} title={result.titre} canSave={canSave} />
    </article>
  );
}

function Delta({ before, after }: { before: number; after: number }) {
  const d = after - before;
  return <div className={styles.kpisub}>avant {before}{d !== 0 && <> · <span className={tone(d)}>{signed(d)}</span></>}</div>;
}

function SaveBar({ scenarioId, input, title, canSave }: { scenarioId: string; input: SimulationInput; title: string; canSave: boolean }) {
  const [name, setName] = useState(`IA – ${title}`);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);
  if (!canSave) return null;
  return (
    <div className={styles.savebar}>
      {msg?.ok && msg.id ? (
        <p role="status" className={styles.saved}>
          {msg.text} <Link href={`/proposition?scenario=${msg.id}`}>Calculer sa proposition</Link> · <Link href={`/parametres?scenario=${msg.id}`}>Voir ses paramètres</Link>
        </p>
      ) : (
        <form
          className={styles.keyrow}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveSimulationAction(scenarioId, name, input);
              setMsg(r.ok ? { ok: true, text: r.message, id: r.id } : { ok: false, text: r.error });
            });
          }}
        >
          <input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Nom du nouveau scénario" className={styles.keyinput} />
          <button type="submit" className={styles.btn} disabled={pending || !name.trim()}>{pending ? "Enregistrement…" : "Enregistrer comme scénario"}</button>
          {msg && !msg.ok && <span role="alert" className={styles.loss}>{msg.text}</span>}
        </form>
      )}
    </div>
  );
}
