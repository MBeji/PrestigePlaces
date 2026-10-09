"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import PlanSvg from "./PlanSvg";
import styles from "./PlanViewer.module.css";
import { hasChanged, PLAN_VIEWS, VIDE, type DirectionStyle, type FloorPlanData, type PlanView } from "./model";

export interface ScenarioOption { id: string; name: string; status: string; isActive: boolean; hasProposal: boolean }

export interface PlanViewerProps {
  floors: FloorPlanData[];
  directions: DirectionStyle[];
  scenarios: ScenarioOption[];
  scenarioId: string;
  /** Proposition (scénario dérivé) affichée, si elle existe. */
  proposal: { id: string; name: string; status: string } | null;
  initialFloor?: string;
  initialView?: PlanView;
}

export const STATUS_LABEL: Record<string, string> = { DRAFT: "brouillon", PROPOSED: "proposé", VALIDATED: "validé", PUBLISHED: "publié" };

/** Onglets par niveau, sélecteur de scénario (formulaire GET) et sélecteur de vue autour de PlanSvg. */
export default function PlanViewer({ floors, directions, scenarios, scenarioId, proposal, initialFloor, initialView }: PlanViewerProps) {
  const [floorCode, setFloorCode] = useState(() => (floors.some((f) => f.code === initialFloor) ? initialFloor! : (floors[0]?.code ?? "")));
  const [view, setView] = useState<PlanView>(() => (proposal ? (initialView ?? "proposition") : "situation"));
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const floor = floors.find((f) => f.code === floorCode) ?? floors[0];

  const changes = useMemo(
    () => floors.reduce((n, f) => n + f.positions.filter((p) => !p.zoneToFree && hasChanged(p) && p.proposed !== VIDE).length, 0),
    [floors],
  );

  function syncUrl(next: { niveau?: string; vue?: PlanView }) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("scenario", scenarioId);
      if (next.niveau) url.searchParams.set("niveau", next.niveau);
      if (next.vue) url.searchParams.set("vue", next.vue);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* URL non synchronisée : sans conséquence */
    }
  }
  function chooseFloor(code: string, focus = false) {
    setFloorCode(code);
    syncUrl({ niveau: code });
    if (focus) tabRefs.current.get(code)?.focus();
  }
  function chooseView(v: PlanView) {
    setView(v);
    syncUrl({ vue: v });
  }
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = floors.findIndex((f) => f.code === floorCode);
    let j = -1;
    if (e.key === "ArrowRight") j = (i + 1) % floors.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + floors.length) % floors.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = floors.length - 1;
    if (j < 0) return;
    e.preventDefault();
    chooseFloor(floors[j].code, true);
  }

  return (
    <>
      <div className={styles.bar}>
        <form className={styles.form} method="get" action="/plans">
          <label>
            Scénario
            <select className={styles.select} name="scenario" defaultValue={scenarioId}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({STATUS_LABEL[s.status] ?? s.status}{s.isActive ? ", actif" : ""}{s.hasProposal ? ", proposition calculée" : ""})
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="niveau" value={floorCode} />
          <input type="hidden" name="vue" value={view} />
          <button type="submit" className={styles.btn}>Afficher</button>
        </form>
        <div className={styles.seg} role="group" aria-label="Vue">
          {PLAN_VIEWS.map((v) => (
            <button key={v.id} type="button" aria-pressed={view === v.id} disabled={v.id !== "situation" && !proposal} onClick={() => chooseView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {proposal ? (
        <p className={styles.meta}>
          Proposition : {proposal.name} ({STATUS_LABEL[proposal.status] ?? proposal.status}) · <b>{changes}</b> positions changent de direction sur le site.
        </p>
      ) : (
        <p className={styles.notice}>
          Aucune proposition calculée pour ce scénario : seule la situation est affichée. Lancez le calcul depuis la page <Link href="/proposition">Proposition</Link>.
        </p>
      )}

      <section className={styles.panel} aria-label="Plans par niveau">
        <div className={styles.row}>
          <div className={styles.tabs} role="tablist" aria-label="Niveaux">
            {floors.map((f) => (
              <button
                key={f.code}
                ref={(el) => { if (el) tabRefs.current.set(f.code, el); else tabRefs.current.delete(f.code); }}
                id={`tab-niveau-${f.code}`}
                className={styles.tab}
                type="button"
                role="tab"
                aria-selected={f.code === floorCode}
                aria-controls="panneau-niveau"
                tabIndex={f.code === floorCode ? 0 : -1}
                onClick={() => chooseFloor(f.code)}
                onKeyDown={onTabKey}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div id="panneau-niveau" role="tabpanel" aria-labelledby={floor ? `tab-niveau-${floor.code}` : undefined}>
          {floor ? <PlanSvg data={floor} view={view} directions={directions} /> : <p>Aucun niveau en base.</p>}
        </div>
      </section>
    </>
  );
}
