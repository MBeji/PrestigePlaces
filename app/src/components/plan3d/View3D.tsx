"use client";

/**
 * Page « Vue 3D » côté client : sélecteur de scénario (formulaire GET comme /plans), vues situation /
 * proposition / changements, scène Three.js chargée à la demande (next/dynamic, ssr: false), tableau des
 * positions par niveau et par direction, liste des open spaces avant → après.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { directionColor, directionLabel, PLAN_VIEWS, type DirectionStyle, type FloorPlanData, type PlanView } from "@/components/plan/model";
import { STATUS_LABEL, type ScenarioOption } from "@/components/plan/PlanViewer";
import viewer from "@/components/plan/PlanViewer.module.css";
import { ALL_FLOORS, countByFloorAndDirection, directionCssVar, countChanges, islandNumbers, islandRows, islandSummaries, type CountCell, type Focus } from "./model3d";
import styles from "./View3D.module.css";

const Plan3D = dynamic(() => import("./Plan3D"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Chargement de la vue 3D…</p>,
});

/** Nombre maximal d'open spaces listés (les plus grands d'abord). */
const MAX_ISLANDS = 40;

export interface View3DProps {
  floors: FloorPlanData[];
  directions: DirectionStyle[];
  scenarios: ScenarioOption[];
  scenarioId: string;
  proposal: { id: string; name: string; status: string } | null;
  initialFocus?: string;
  initialView?: PlanView;
}

const shortLabel = (code: string, directions: readonly DirectionStyle[]) => directionLabel(code, directions).replace(" (hors équation)", "");
/** Couleur d'une direction : variable du thème (clair ou sombre), à défaut la couleur en base. */
const swatch = (code: string, directions: readonly DirectionStyle[]) => `var(${directionCssVar(code)}, ${directionColor(code, directions)})`;

function BeforeAfter({ cell }: { cell: CountCell | undefined }) {
  if (!cell || (!cell.before && !cell.after)) return null;
  if (cell.before === cell.after) return <>{cell.before}</>;
  return (
    <>
      {cell.before} <span className={styles.arrow}>→</span> <b>{cell.after}</b>
    </>
  );
}

export default function View3D({ floors, directions, scenarios, scenarioId, proposal, initialFocus, initialView }: View3DProps) {
  const [view, setView] = useState<PlanView>(() => (proposal ? (initialView ?? "proposition") : "situation"));
  const [focus, setFocus] = useState<Focus>(() => (floors.some((f) => f.code === initialFocus) ? initialFocus! : ALL_FLOORS));

  const table = useMemo(() => countByFloorAndDirection(floors, directions), [floors, directions]);
  const changes = useMemo(() => countChanges(floors), [floors]);
  const islands = useMemo(() => islandNumbers(floors), [floors]);
  const openSpaces = useMemo(() => islandSummaries(floors, focus, { islands }), [floors, focus, islands]);
  const focusLabel = floors.find((f) => f.code === focus)?.label;

  function syncUrl(next: { niveau?: Focus; vue?: PlanView }) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("scenario", scenarioId);
      if (next.niveau !== undefined) {
        if (next.niveau === ALL_FLOORS) url.searchParams.delete("niveau");
        else url.searchParams.set("niveau", next.niveau);
      }
      if (next.vue) url.searchParams.set("vue", next.vue);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* URL non synchronisée : sans conséquence */
    }
  }
  function chooseView(v: PlanView) {
    setView(v);
    syncUrl({ vue: v });
  }
  function chooseFocus(f: Focus) {
    setFocus(f);
    syncUrl({ niveau: f });
  }

  return (
    <>
      <div className={viewer.bar}>
        <form className={viewer.form} method="get" action="/vue-3d">
          <label>
            Scénario
            <select className={viewer.select} name="scenario" defaultValue={scenarioId}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({STATUS_LABEL[s.status] ?? s.status}{s.isActive ? ", actif" : ""}{s.hasProposal ? ", proposition calculée" : ""})
                </option>
              ))}
            </select>
          </label>
          {focus !== ALL_FLOORS ? <input type="hidden" name="niveau" value={focus} /> : null}
          <input type="hidden" name="vue" value={view} />
          <button type="submit" className={viewer.btn}>Afficher</button>
        </form>
        <div className={viewer.seg} role="group" aria-label="Vue">
          {PLAN_VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} disabled={v.id !== "situation" && !proposal} onClick={() => chooseView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {proposal ? (
        <p className={viewer.meta}>
          Proposition : {proposal.name} ({STATUS_LABEL[proposal.status] ?? proposal.status}) · <b>{changes}</b> positions changent de direction sur le site.
        </p>
      ) : (
        <p className={viewer.notice}>
          Aucune proposition calculée pour ce scénario : seule la situation est affichée. Lancez le calcul depuis la page <Link href="/proposition">Proposition</Link>.
        </p>
      )}

      <section className={`${viewer.panel} ${styles.panel}`} aria-labelledby="h-3d">
        <h2 id="h-3d" className={styles.h2}>Vue 3D du site</h2>
        <p className={styles.hint}>
          Faites glisser pour tourner, molette ou pincement pour zoomer. Les volumes hauts sont les postes fixes ; en vue « Changements », les positions
          qui changent sont surélevées et les autres atténuées.
        </p>
        <div className={styles.grid}>
          <div className={styles.sceneCol}>
            <Plan3D floors={floors} directions={directions} view={view} focus={focus} onFocusChange={chooseFocus} scenarioId={scenarioId} />
            <ul className={styles.legend} aria-label="Légende des directions">
              {table.columns.map((code) => (
                <li key={code}>
                  <span className="sw" style={{ background: swatch(code, directions) }} />
                  {directionLabel(code, directions)}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.side}>
            <h3 className={styles.h3} id="h-islands">
              {focus === ALL_FLOORS ? "Open spaces (tous niveaux, par taille)" : `Open spaces · ${focusLabel ?? focus}`}
            </h3>
            <ul className={styles.islands} aria-labelledby="h-islands">
              {openSpaces.length ? (
                openSpaces.slice(0, MAX_ISLANDS).map((g) => (
                  <li key={`${g.floor}:${g.island}`}>
                    <span className={styles.n}>{g.size}</span>
                    <span>
                      {g.floorLabel} · îlot {g.island} :{" "}
                      {islandRows(g).map((r, i) => (
                        <span key={r.code}>
                          {i ? " · " : null}
                          <span className="sw" style={{ background: swatch(r.code, directions) }} /> {shortLabel(r.code, directions)}{" "}
                          {r.before === r.after ? r.before : (
                            <>
                              {r.before} <span className={styles.arrow}>→</span> <b>{r.after}</b>
                            </>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))
              ) : (
                <li>Aucun open space sur ce niveau.</li>
              )}
            </ul>
            {openSpaces.length > MAX_ISLANDS ? <p className={styles.caption}>{openSpaces.length - MAX_ISLANDS} open spaces plus petits non listés.</p> : null}
          </div>
        </div>
        <div className={styles.tableBlock}>
          <h3 className={styles.h3} id="h-floor-table">Positions par niveau et par direction</h3>
          <p className={styles.caption}>{proposal ? "Situation → proposition ; une seule valeur quand elle ne change pas." : "Situation du scénario."}</p>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-labelledby="h-floor-table">
              <thead>
                <tr>
                  <th scope="col">Niveau</th>
                  {table.columns.map((code) => (
                    <th key={code} scope="col" className={styles.c}>
                      <span className="sw" style={{ background: swatch(code, directions) }} /> {shortLabel(code, directions)}
                    </th>
                  ))}
                  <th scope="col" className={styles.c}>Total</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.code} aria-current={focus === row.code ? "true" : undefined}>
                    <th scope="row">{row.label}</th>
                    {table.columns.map((code) => (
                      <td key={code} className={styles.c}><BeforeAfter cell={row.cells[code]} /></td>
                    ))}
                    <td className={styles.c}><b>{row.total}</b></td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <th scope="row">Total</th>
                  {table.columns.map((code) => (
                    <td key={code} className={styles.c}><BeforeAfter cell={table.totals[code]} /></td>
                  ))}
                  <td className={styles.c}><b>{table.total}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
