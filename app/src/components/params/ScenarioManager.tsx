"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateAction, createScenarioAction, duplicateScenarioAction, setStatusAction } from "@/app/scenarios/actions";
import { STATUS_LABELS } from "./format";
import styles from "./params.module.css";

export interface ScenarioItem {
  id: string; name: string; status: "DRAFT" | "PROPOSED" | "VALIDATED" | "PUBLISHED"; isActive: boolean; createdAt: string;
  reservePct: number; assignments: number; movements: number; parentId: string | null;
}

const TRANSITIONS: Record<ScenarioItem["status"], ScenarioItem["status"][]> = {
  DRAFT: ["PROPOSED"], PROPOSED: ["DRAFT", "VALIDATED"], VALIDATED: ["PROPOSED", "PUBLISHED"], PUBLISHED: ["VALIDATED"],
};
const TARGET_LABEL: Record<ScenarioItem["status"], string> = { DRAFT: "Repasser en brouillon", PROPOSED: "Marquer proposé", VALIDATED: "Valider", PUBLISHED: "Publier" };

export default function ScenarioManager({
  scenarios, can,
}: { scenarios: ScenarioItem[]; can: { gerer: boolean; valider: boolean; publier: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const roots = scenarios.filter((s) => !s.parentId);

  const exec = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { kind: "ok", text: r.message ?? "Terminé." } : { kind: "err", text: r.error });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const allowed = (to: ScenarioItem["status"]) => (to === "VALIDATED" ? can.valider : to === "PUBLISHED" ? can.publier : can.gerer);
  const nameOk = name.trim().length > 0;

  return (
    <div className={styles.stack}>
      {msg && <div className={`${styles.msg} ${msg.kind === "err" ? styles.err : styles.ok}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
      <section className="panel">
        <h2>Nouveau scénario</h2>
        <form className={styles.addrow} onSubmit={(e) => { e.preventDefault(); if (nameOk) exec(() => createScenarioAction({ name, fromScenarioId: from }), () => setName("")); }}>
          <label htmlFor="sc-name">Nom</label>
          <input id="sc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!can.gerer || pending} style={{ minWidth: 220 }} />
          <label htmlFor="sc-from">Copier depuis</label>
          <select id="sc-from" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!can.gerer || pending}>
            <option value="">Scénario actif</option>
            {roots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!can.gerer || pending || !nameOk}>Créer</button>
        </form>
      </section>
      <section className="panel">
        <h2>Scénarios</h2>
        <div className={styles.tablewrap}>
          <table>
            <thead>
              <tr><th>Nom</th><th>Statut</th><th className="num">Réserve</th><th className="num">Affectations</th><th className="num">Mouvements</th><th>Créé le</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td style={{ paddingLeft: s.parentId ? 24 : 6 }}>
                    {s.parentId ? "↳ " : ""}<strong>{s.name}</strong>
                    {s.isActive && <> <span className={styles.tag}>actif</span></>}
                  </td>
                  <td>{STATUS_LABELS[s.status]}</td>
                  <td className="num">{s.reservePct} %</td>
                  <td className="num">{s.assignments}</td>
                  <td className="num">{s.movements}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString("fr-FR", { timeZone: "UTC" })}</td>
                  <td>
                    <div className={styles.addrow}>
                      {!s.parentId && <Link href={`/parametres?scenario=${s.id}`}>Paramètres</Link>}
                      {!s.parentId && <Link href={`/proposition?scenario=${s.id}`}>Proposition</Link>}
                      {!s.parentId && (
                        <button type="button" className={`${styles.btn} ${styles.small}`} disabled={!can.gerer || pending} onClick={() => exec(() => duplicateScenarioAction(s.id))}>Dupliquer</button>
                      )}
                      {!s.parentId && !s.isActive && (
                        <button type="button" className={`${styles.btn} ${styles.small}`} disabled={!can.gerer || pending} onClick={() => exec(() => activateAction(s.id))}>Activer</button>
                      )}
                      {TRANSITIONS[s.status].map((to) => (
                        <button key={to} type="button" className={`${styles.btn} ${styles.small}`} disabled={!allowed(to) || pending} onClick={() => exec(() => setStatusAction(s.id, to))}>
                          {TARGET_LABEL[to]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
