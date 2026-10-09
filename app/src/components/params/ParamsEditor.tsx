"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { computeQuotas } from "@/lib/engine/quotas";
import {
  addExternalAction, addRecruitmentAction, removeExternalAction, removeRecruitmentAction, resetToWorkbookAction, saveDirectionAction, saveScenarioParamsAction,
} from "@/app/parametres/actions";
import { commonRate, formatRatio, parseCount, SOURCE_LABELS, targetHeadcount } from "./format";
import styles from "./params.module.css";

export interface DirectionRow {
  directionCode: string;
  label: string;
  color: string;
  cdi: number;
  externes: number;
  recrutements: number;
  fixedSeats: number;
  recruitments: { id: string; count: number; source: "SIRH" | "MAIL_CLIENT"; expectedDate: string; reference: string | null; counted: boolean }[];
  externals: { id: string; count: number; endDate: string | null; counted?: boolean }[];
}

export interface ParamsEditorProps {
  scenarioId: string;
  locked: boolean;
  canManage: boolean;
  editable: string[];
  directions: DirectionRow[];
  /** Positions à répartir avant réserve (hors SUP et zones à libérer). */
  pool: number;
  reservePct: number;
  recruitWindowMonths: number;
  baseZoneCount: number;
  extraZones: { positionId: string; floor: string; r: number; c: number }[];
}

type Feedback = { kind: "ok" | "err"; text: string } | null;

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const exec = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setFeedback(r.ok ? { kind: "ok", text: r.message ?? "Enregistré." } : { kind: "err", text: r.error });
      if (r.ok) router.refresh();
    });
  return { pending, feedback, setFeedback, exec };
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");

export default function ParamsEditor(p: ParamsEditorProps) {
  const { pending, feedback, setFeedback, exec } = useAction();
  const [reserve, setReserve] = useState(String(p.reservePct));
  const [windowM, setWindowM] = useState(String(p.recruitWindowMonths));
  // Valeurs en cours de saisie, pour l'estimation des quotas.
  const [drafts, setDrafts] = useState<Record<string, { cdi: number; externes: number; recrutements: number }>>({});

  const reserveNum = Number(reserve.replace(",", "."));
  const reserveValid = reserve.trim() !== "" && Number.isFinite(reserveNum) && reserveNum >= 0 && reserveNum <= 50;
  const windowParsed = parseCount(windowM, 24);
  const windowValid = windowParsed.ok && windowParsed.value >= 1;

  const rows = p.directions.map((d) => ({ ...d, ...(drafts[d.directionCode] ?? {}) }));
  const quotas = computeQuotas({
    directions: rows.map((d) => ({ code: d.directionCode, cdi: d.cdi, externes: d.externes, recrutements: d.recrutements, fixedSeats: d.fixedSeats })),
    positionsToAllocate: p.pool,
    reservePct: reserveValid ? reserveNum : p.reservePct,
  });
  const totalTarget = rows.reduce((s, d) => s + targetHeadcount(d), 0);
  const readOnly = (code: string) => p.locked || !p.editable.includes(code);

  const saveScenario = () => {
    if (!reserveValid || !windowValid || !windowParsed.ok) return;
    exec(() => saveScenarioParamsAction(p.scenarioId, { reservePct: reserveNum, recruitWindowMonths: windowParsed.value }));
  };

  return (
    <div className={styles.stack}>
      {p.locked && <div className={styles.msg}>Scénario validé ou publié : les paramètres sont verrouillés.</div>}
      {feedback && (
        <div className={`${styles.msg} ${feedback.kind === "err" ? styles.err : styles.ok}`} role={feedback.kind === "err" ? "alert" : "status"}>
          {feedback.text}
        </div>
      )}

      <div className="kpis" style={{ marginBottom: 0 }}>
        <Kpi label="Positions à répartir" value={quotas.alloc} hint={quotas.reserve > 0 ? `${p.pool} moins ${quotas.reserve} en réserve` : undefined} />
        <Kpi label="Effectif cible" value={totalTarget} />
        <Kpi label="Taux commun" value={formatRatio(commonRate(quotas.alloc, totalTarget))} hint="positions par personne" />
      </div>

      <section className="panel">
        <div className={styles.toolbar}>
          <h2 style={{ margin: 0 }}>Effectifs par direction</h2>
          <button
            type="button"
            className={styles.btn}
            disabled={pending || p.locked || !p.canManage}
            onClick={() => {
              if (window.confirm("Remplacer les valeurs de ce scénario par celles du classeur d'origine (effectifs, recrutements, externes, réserve) ?")) {
                setDrafts({});
                exec(() => resetToWorkbookAction(p.scenarioId));
              }
            }}
          >
            Revenir aux valeurs du classeur
          </button>
        </div>
        <div className={styles.tablewrap}>
          <table>
            <thead>
              <tr>
                <th>Direction</th>
                <th className="num">CDI</th>
                <th className="num">Externes</th>
                <th className="num">Recrutements</th>
                <th className="num">Effectif cible</th>
                <th className="num">Postes fixes</th>
                <th className="num">Quota estimé</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <DirectionLine
                  key={`${d.directionCode}-${p.directions.find((x) => x.directionCode === d.directionCode)!.cdi}-${p.directions.find((x) => x.directionCode === d.directionCode)!.externes}-${p.directions.find((x) => x.directionCode === d.directionCode)!.recrutements}`}
                  row={d}
                  disabled={readOnly(d.directionCode) || pending}
                  quota={quotas.quotas[d.directionCode]}
                  onDraft={(v) => setDrafts((x) => ({ ...x, [d.directionCode]: v }))}
                  onSave={(v) => exec(() => saveDirectionAction(p.scenarioId, d.directionCode, v))}
                  onError={(text) => setFeedback({ kind: "err", text })}
                />
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.muted} style={{ marginBottom: 0 }}>
          Les totaux « Externes » et « Recrutements » sont recalculés dès qu&apos;une ligne est ajoutée ou supprimée dans les listes ci-dessous. Le quota estimé suit la saisie ;
          la proposition complète est calculée dans l&apos;onglet Proposition.
        </p>
      </section>

      <section className="panel">
        <h2>Recrutements et consultants externes</h2>
        {rows.map((d) => (
          <Lists key={d.directionCode} row={d} scenarioId={p.scenarioId} disabled={readOnly(d.directionCode) || pending} exec={exec} />
        ))}
        <p className={styles.muted} style={{ marginBottom: 0 }}>
          Un recrutement est compté s&apos;il est ouvert dans le SIRH, ou déclaré par mail client avec une date comprise dans la fenêtre de {p.recruitWindowMonths} mois.
        </p>
      </section>

      <section className="panel">
        <h2>Paramètres du scénario</h2>
        <div className={styles.addrow}>
          <label htmlFor="reserve">Réserve (%)</label>
          <input id="reserve" type="text" inputMode="decimal" className={`cell ${reserveValid ? "" : "invalid"}`} style={{ width: 84, textAlign: "right" }} value={reserve}
            onChange={(e) => setReserve(e.target.value)} disabled={p.locked || !p.canManage || pending} aria-invalid={!reserveValid} />
          <label htmlFor="window">Fenêtre des recrutements (mois)</label>
          <input id="window" type="text" inputMode="numeric" style={{ width: 84, textAlign: "right" }} value={windowM}
            onChange={(e) => setWindowM(e.target.value)} disabled={p.locked || !p.canManage || pending} aria-invalid={!windowValid} />
          <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={p.locked || !p.canManage || pending || !reserveValid || !windowValid} onClick={saveScenario}>
            Enregistrer
          </button>
        </div>
        {(!reserveValid || !windowValid) && <p className={styles.err} style={{ border: 0 }}>Réserve : nombre de 0 à 50. Fenêtre : entier de 1 à 24.</p>}
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Zones à libérer</h3>
        <p className={styles.muted} style={{ marginTop: 0 }}>
          {p.baseZoneCount} positions du plan (centre du RDC, future salle de formation) ne sont jamais affectées.
          {p.extraZones.length > 0 ? ` ${p.extraZones.length} zone(s) supplémentaire(s) propres à ce scénario :` : " Aucune zone supplémentaire pour ce scénario."}
        </p>
        {p.extraZones.length > 0 && (
          <div className={styles.chips}>
            {p.extraZones.map((z) => (
              <span key={z.positionId} className={styles.chip}>niveau {z.floor}, ligne {z.r}, colonne {z.c}</span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {hint && <div className={styles.muted} style={{ fontSize: 11 }}>{hint}</div>}
    </div>
  );
}

function DirectionLine({
  row, disabled, quota, onDraft, onSave, onError,
}: {
  row: DirectionRow;
  disabled: boolean;
  quota: number;
  onDraft: (v: { cdi: number; externes: number; recrutements: number }) => void;
  onSave: (v: { cdi: number; externes: number; recrutements: number }) => void;
  onError: (text: string) => void;
}) {
  const [text, setText] = useState({ cdi: String(row.cdi), externes: String(row.externes), recrutements: String(row.recrutements) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const base = { cdi: row.cdi, externes: row.externes, recrutements: row.recrutements };

  const change = (field: keyof typeof text, value: string) => {
    const next = { ...text, [field]: value };
    setText(next);
    const parsed = parseCount(value);
    setErrors((e) => {
      const copy = { ...e };
      if (parsed.ok) delete copy[field];
      else copy[field] = parsed.error;
      return copy;
    });
    const nums = { cdi: parseCount(next.cdi), externes: parseCount(next.externes), recrutements: parseCount(next.recrutements) };
    if (nums.cdi.ok && nums.externes.ok && nums.recrutements.ok) onDraft({ cdi: nums.cdi.value, externes: nums.externes.value, recrutements: nums.recrutements.value });
  };

  const commit = () => {
    const nums = { cdi: parseCount(text.cdi), externes: parseCount(text.externes), recrutements: parseCount(text.recrutements) };
    if (!nums.cdi.ok || !nums.externes.ok || !nums.recrutements.ok) {
      const bad = [nums.cdi, nums.externes, nums.recrutements].find((n) => !n.ok);
      onError(`${row.label} : ${bad && !bad.ok ? bad.error : "valeur invalide."}`);
      return;
    }
    const v = { cdi: nums.cdi.value, externes: nums.externes.value, recrutements: nums.recrutements.value };
    if (v.cdi === base.cdi && v.externes === base.externes && v.recrutements === base.recrutements) return;
    onSave(v);
  };

  const live = parseCount(text.cdi).ok && parseCount(text.externes).ok && parseCount(text.recrutements).ok
    ? Number(text.cdi) + Number(text.externes) + Number(text.recrutements)
    : targetHeadcount(base);

  const field = (f: keyof typeof text, label: string) => (
    <td className="num">
      <input
        type="text" inputMode="numeric" className={`cell ${errors[f] ? "invalid" : ""}`} value={text[f]} disabled={disabled}
        aria-label={`${label} de ${row.label}`} aria-invalid={!!errors[f]} title={errors[f]}
        onChange={(e) => change(f, e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        style={{ width: 84, textAlign: "right", fontFamily: "var(--mono)" }}
      />
    </td>
  );

  return (
    <tr>
      <td><span className={styles.dirname}><span className="sw" style={{ background: row.color }} />{row.label}</span></td>
      {field("cdi", "CDI")}
      {field("externes", "Externes")}
      {field("recrutements", "Recrutements")}
      <td className="num"><strong>{live}</strong></td>
      <td className="num">{row.fixedSeats}</td>
      <td className="num">{quota}</td>
    </tr>
  );
}

function Lists({ row, scenarioId, disabled, exec }: { row: DirectionRow; scenarioId: string; disabled: boolean; exec: ReturnType<typeof useAction>["exec"] }) {
  const [rc, setRc] = useState({ count: "1", source: "SIRH" as "SIRH" | "MAIL_CLIENT", date: "", reference: "" });
  const [ec, setEc] = useState({ count: "1", date: "" });
  const rcCount = parseCount(rc.count, 10000);
  const ecCount = parseCount(ec.count, 10000);
  const rcOk = rcCount.ok && rcCount.value >= 1 && rc.date !== "";
  const ecOk = ecCount.ok && ecCount.value >= 1;

  return (
    <details>
      <summary>
        <span className={styles.dirname}><span className="sw" style={{ background: row.color }} />{row.label}</span>{" "}
        <span className={styles.muted}>({row.recruitments.length} recrutement(s), {row.externals.length} ligne(s) d&apos;externes)</span>
      </summary>
      <div className={styles.lists}>
        <div>
          <h4>Recrutements</h4>
          <ul>
            {row.recruitments.length === 0 && <li className={styles.muted}>Aucun.</li>}
            {row.recruitments.map((r) => (
              <li key={r.id}>
                <strong>{r.count}</strong>
                <span className={styles.tag}>{SOURCE_LABELS[r.source]}</span>
                <span>{fmtDate(r.expectedDate)}</span>
                {r.reference && <span className={styles.muted}>{r.reference}</span>}
                {!r.counted && <span className={`${styles.tag} ${styles.tagoff}`}>hors fenêtre</span>}
                <button type="button" className={`${styles.btn} ${styles.small} ${styles.danger}`} disabled={disabled} onClick={() => exec(() => removeRecruitmentAction(scenarioId, r.id))} aria-label={`Supprimer le recrutement de ${r.count} (${row.label})`}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.addrow}>
            <input type="text" inputMode="numeric" aria-label={`Nombre de recrutements ${row.label}`} style={{ width: 60 }} value={rc.count} onChange={(e) => setRc({ ...rc, count: e.target.value })} disabled={disabled} />
            <select aria-label={`Source ${row.label}`} value={rc.source} onChange={(e) => setRc({ ...rc, source: e.target.value as "SIRH" | "MAIL_CLIENT" })} disabled={disabled}>
              <option value="SIRH">SIRH</option>
              <option value="MAIL_CLIENT">Mail client</option>
            </select>
            <input type="date" aria-label={`Date ${row.label}`} value={rc.date} onChange={(e) => setRc({ ...rc, date: e.target.value })} disabled={disabled} />
            <input type="text" placeholder="Référence" aria-label={`Référence ${row.label}`} style={{ width: 120 }} value={rc.reference} onChange={(e) => setRc({ ...rc, reference: e.target.value })} disabled={disabled} />
            <button
              type="button" className={styles.btn} disabled={disabled || !rcOk}
              onClick={() => {
                if (!rcCount.ok) return;
                exec(() => addRecruitmentAction(scenarioId, { directionCode: row.directionCode, count: rcCount.value, source: rc.source, expectedDate: rc.date, reference: rc.reference }));
                setRc({ ...rc, count: "1", reference: "" });
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
        <div>
          <h4>Consultants externes</h4>
          <ul>
            {row.externals.length === 0 && <li className={styles.muted}>Aucun.</li>}
            {row.externals.map((e) => (
              <li key={e.id}>
                <strong>{e.count}</strong>
                <span>fin de mission : {fmtDate(e.endDate)}</span>
                {e.counted === false && <span className={`${styles.tag} ${styles.tagoff}`}>mission terminée</span>}
                <button type="button" className={`${styles.btn} ${styles.small} ${styles.danger}`} disabled={disabled} onClick={() => exec(() => removeExternalAction(scenarioId, e.id))} aria-label={`Supprimer ${e.count} consultant(s) externe(s) (${row.label})`}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.addrow}>
            <input type="text" inputMode="numeric" aria-label={`Nombre d'externes ${row.label}`} style={{ width: 60 }} value={ec.count} onChange={(e) => setEc({ ...ec, count: e.target.value })} disabled={disabled} />
            <input type="date" aria-label={`Date de fin ${row.label}`} value={ec.date} onChange={(e) => setEc({ ...ec, date: e.target.value })} disabled={disabled} />
            <button
              type="button" className={styles.btn} disabled={disabled || !ecOk}
              onClick={() => {
                if (!ecCount.ok) return;
                exec(() => addExternalAction(scenarioId, { directionCode: row.directionCode, count: ecCount.value, endDate: ec.date || undefined }));
                setEc({ count: "1", date: "" });
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
