"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import styles from "./PlanSvg.module.css";
import {
  buildPlanModel, CELL_SIZE, directionColor, nextSeat, PLAN_VIEWS, seatDetails, summarizeFloor, SUPPORT,
  type DirectionStyle, type FloorPlanData, type NavKey, type PlanView,
} from "./model";

export interface PlanSvgProps {
  data: FloorPlanData;
  view: PlanView;
  /** Directions (libellés et couleurs issus de la base). */
  directions: readonly DirectionStyle[];
}

const NAV_KEYS: readonly string[] = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
const CELL_FILL: Record<string, string> = { room: "var(--room)", green: "var(--room)", office: "var(--office)", desk: "var(--desk)" };

/**
 * Plan SVG d'un niveau (port de renderPlan du prototype) : cellules, positions colorées par direction,
 * postes fixes D/M, Support hachuré, zone à libérer, contour épais des changements, légende, résumé du niveau
 * et panneau de détail (survol, clic, clavier : flèches, Début, Fin, Entrée, Échap).
 */
export default function PlanSvg({ data, view, directions }: PlanSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { training: `pp-training-${uid}`, support: `pp-support-${uid}`, zone: `pp-zone-${uid}`, help: `pp-help-${uid}`, detail: `pp-detail-${uid}` };
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [rovingId, setRovingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const model = useMemo(() => buildPlanModel(data, view, directions), [data, view, directions]);
  const summary = useMemo(() => summarizeFloor(data, directions), [data, directions]);
  const byId = useMemo(() => new Map(data.positions.map((p) => [p.id, p])), [data]);
  const hasProposal = data.positions.some((p) => p.proposed !== null);
  const hasExtraZone = data.positions.some((p) => p.extraZone);
  const supportColor = directionColor(SUPPORT, directions);
  const S = CELL_SIZE;

  const tabbableId = rovingId && byId.has(rovingId) ? rovingId : (nextSeat(model.seats, null, "Home")?.id ?? null);
  const detailId = [hoverId, focusId, selectedId].find((x) => x && byId.has(x)) ?? null;
  const detailPos = detailId ? byId.get(detailId)! : null;
  const selected = selectedId && byId.has(selectedId) ? model.seats.find((s) => s.id === selectedId) ?? null : null;
  const viewLabel = PLAN_VIEWS.find((v) => v.id === view)?.label ?? view;

  function focusSeat(id: string) {
    setRovingId(id);
    const el = svgRef.current?.querySelector<SVGRectElement>(`[data-id="${CSS.escape(id)}"]`);
    el?.focus();
  }

  function onSeatKey(e: KeyboardEvent<SVGRectElement>, id: string) {
    if (NAV_KEYS.includes(e.key)) {
      e.preventDefault();
      const n = nextSeat(model.seats, id, e.key as NavKey);
      if (n) focusSeat(n.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId((cur) => (cur === id ? null : id));
    } else if (e.key === "Escape") {
      setSelectedId(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.planwrap}>
        <svg
          ref={svgRef}
          className={styles.plan}
          viewBox={`0 0 ${model.width} ${model.height}`}
          role="group"
          aria-label={`Plan du niveau ${data.label}, vue ${viewLabel}`}
          aria-describedby={ids.help}
          onMouseLeave={() => setHoverId(null)}
        >
          <defs>
            <pattern id={ids.training} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <rect width="6" height="6" fill="var(--room)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--fg-2)" strokeWidth="1" opacity="0.5" />
            </pattern>
            <pattern id={ids.support} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill={supportColor} opacity="0.35" />
              <line x1="0" y1="0" x2="0" y2="4" stroke={supportColor} strokeWidth="1.5" />
            </pattern>
            <pattern id={ids.zone} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="var(--c-vide)" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--critical)" strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={model.width} height={model.height} fill="var(--surface)" />
          {model.cells.map((c) =>
            c.kind === "wall" ? (
              <rect key={c.key} x={c.x} y={c.y} width={S} height={S} fill="none" stroke="var(--wall)" strokeWidth="0.6" />
            ) : (
              <rect key={c.key} x={c.x} y={c.y} width={S} height={S}
                fill={c.kind === "training" ? `url(#${ids.training})` : CELL_FILL[c.kind]}
                opacity={c.kind === "green" ? 0.7 : undefined} />
            ),
          )}
          {model.seats.map((s) => {
            const fill = s.pattern === "support" ? `url(#${ids.support})` : s.pattern === "zone" ? `url(#${ids.zone})` : s.fill;
            const stroke = s.outline ? "var(--fg)" : "none";
            const strokeWidth = s.outline === "changed" ? 1.6 : s.outline === "fixed" ? 1.2 : undefined;
            return (
              <g key={s.id} opacity={s.dim ? 0.25 : 1}>
                <rect
                  className={styles.seat}
                  data-id={s.id}
                  data-dir={s.shown}
                  data-changed={s.changed && view !== "situation" ? "true" : undefined}
                  x={s.x + 1.5} y={s.y + 1.5} width={S - 3} height={S - 3} rx="2"
                  fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                  role="button"
                  tabIndex={s.id === tabbableId ? 0 : -1}
                  aria-label={s.label}
                  aria-pressed={s.id === selectedId}
                  aria-controls={ids.detail}
                  onMouseEnter={() => setHoverId(s.id)}
                  onClick={() => { setRovingId(s.id); setSelectedId((cur) => (cur === s.id ? null : s.id)); }}
                  onFocus={() => { setFocusId(s.id); setRovingId(s.id); }}
                  onBlur={() => setFocusId(null)}
                  onKeyDown={(e) => onSeatKey(e, s.id)}
                />
                {s.mark && (
                  <text x={s.x + S / 2} y={s.y + S / 2 + 3} textAnchor="middle" fontSize="8" fontFamily="var(--mono)" fontWeight="500"
                    fill="var(--fg)" pointerEvents="none" aria-hidden="true">
                    {s.mark}
                  </text>
                )}
              </g>
            );
          })}
          {selected && <rect className={styles.ring} x={selected.x - 0.5} y={selected.y - 0.5} width={S + 1} height={S + 1} rx="3" />}
          {model.zone && (
            <g pointerEvents="none">
              <text x={model.zone.x} y={model.zone.y - 2} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--fg)">Salle de formation</text>
              <text x={model.zone.x} y={model.zone.y + 10} textAnchor="middle" fontSize="8.5" fill="var(--fg-2)">{model.zone.count} positions libérées (ex-BLI)</text>
            </g>
          )}
        </svg>
      </div>
      <p id={ids.help} className={styles.hint}>
        Survolez ou cliquez une position pour son détail. Au clavier : Tab pour entrer dans le plan, flèches pour se déplacer, Entrée pour épingler, Échap pour libérer.
      </p>

      <ul className={styles.legend} aria-label="Légende">
        {directions.filter((d) => d.inEquation).map((d) => (
          <li key={d.code}><span className={styles.sw} style={{ background: d.color }} />{d.label}</li>
        ))}
        {directions.filter((d) => !d.inEquation).map((d) => (
          <li key={d.code}>
            <span className={styles.sw} style={{ background: `repeating-linear-gradient(45deg, ${d.color} 0 2px, transparent 2px 4px)`, boxShadow: `inset 0 0 0 1px ${d.color}` }} />
            {d.label} (hors équation)
          </li>
        ))}
        <li><span className={styles.sw} style={{ background: "var(--c-vide)" }} />Vide ou réserve</li>
        <li><span className={`${styles.sw} ${styles.swFixed}`} />D, M : poste fixe (directeur, manager)</li>
        {view !== "situation" && hasProposal && <li><span className={`${styles.sw} ${styles.swChanged}`} />contour épais : position qui change</li>}
        <li><span className={styles.sw} style={{ background: "var(--room)" }} />salles et espaces communs</li>
        <li><span className={styles.sw} style={{ background: "var(--office)" }} />bureaux de direction</li>
        <li><span className={styles.sw} style={{ background: "var(--desk)" }} />extensions de bureau manager</li>
        {model.zone && <li><span className={`${styles.sw} ${styles.swTraining}`} />centre du RDC libéré (salle de formation)</li>}
        {hasExtraZone && view !== "situation" && hasProposal && <li><span className={`${styles.sw} ${styles.swZone}`} />zone à libérer du scénario</li>}
      </ul>

      <ul className={styles.summary} aria-label={`Positions par direction sur le niveau ${data.label}${hasProposal ? ", avant puis après" : ""}`}>
        {summary.map((row) => (
          <li key={row.code} className={styles.chip}>
            <span className={styles.sw} style={{ background: row.color }} />
            {row.label}{" "}
            {row.before === row.after ? (
              <b>{row.after}</b>
            ) : (
              <span>
                {row.before} <span className={styles.arrow} aria-label="devient">→</span>{" "}
                <b className={row.after > row.before ? styles.up : styles.down}>{row.after}</b>
              </span>
            )}
          </li>
        ))}
      </ul>

      <section id={ids.detail} className={styles.detail} aria-live="polite" aria-label="Détail de la position">
        {detailPos ? (
          <>
            <div className={styles.detailHead}>
              <h3>Position {detailPos.r}-{detailPos.c}{detailId === selectedId ? " (épinglée)" : ""}</h3>
              {selectedId && byId.has(selectedId) && (
                <button type="button" className={styles.close} onClick={() => setSelectedId(null)}>Libérer la sélection</button>
              )}
            </div>
            <dl className={styles.dl}>
              {seatDetails(detailPos, data.label, directions).map((d) => (
                <div key={d.term}><dt>{d.term}</dt><dd>{d.value}</dd></div>
              ))}
            </dl>
          </>
        ) : (
          <p>Aucune position sélectionnée.</p>
        )}
      </section>
    </div>
  );
}
