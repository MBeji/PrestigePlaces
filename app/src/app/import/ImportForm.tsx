"use client";

import { useRef, useState, useTransition } from "react";
import { confirmAction, previewAction } from "./actions";
import type { ImportPreview } from "@/lib/import/types";

type Props = { scenarios: { id: string; name: string; isActive: boolean }[] };

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export default function ImportForm({ scenarios }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (kind: "preview" | "confirm") => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setError(null);
    setDone(null);
    startTransition(async () => {
      if (kind === "preview") {
        const r = await previewAction(data);
        if (r.ok) setPreview(r.preview);
        else {
          setPreview(null);
          setError(r.error);
        }
      } else {
        const r = await confirmAction(data);
        if (r.ok) {
          setDone(r.message);
          setPreview(null);
        } else setError(r.error);
      }
    });
  };

  const defaultScenario = scenarios.find((s) => s.isActive)?.id ?? scenarios[0]?.id ?? "";

  return (
    <>
      <form
        ref={formRef}
        className="panel"
        style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          run("preview");
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          Fichier d&apos;extraction RH
          <input type="file" name="fichier" accept=".xlsx,.xls,.csv" required onChange={() => setPreview(null)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Scénario à mettre à jour
          <select name="scenarioId" defaultValue={defaultScenario} required onChange={() => setPreview(null)}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? " (actif)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending || !scenarios.length}>
          {pending ? "Analyse en cours…" : "Prévisualiser les écarts"}
        </button>
      </form>

      {!scenarios.length && <p role="alert">Aucun scénario : créez-en un avant d&apos;importer.</p>}
      {error && (
        <p role="alert" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" style={{ color: "var(--good)" }}>
          {done}
        </p>
      )}

      {preview && (
        <section className="panel" aria-live="polite">
          <h2 style={{ marginTop: 0 }}>Écarts avec le dernier import</h2>
          <p className="sub">
            {preview.stats.retenues} personnes retenues sur {preview.stats.lues} lignes lues.{" "}
            {preview.aPrecedent
              ? `Référence : import du ${new Date(preview.dateReference!).toLocaleDateString("fr-FR")}.`
              : "Aucun import précédent : tous les effectifs sont des entrées."}
          </p>
          {preview.avertissements.map((w) => (
            <p key={w} className="soon">
              {w}
            </p>
          ))}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Groupe</th>
                  <th>Direction</th>
                  <th className="num">Avant</th>
                  <th className="num">Après</th>
                  <th className="num">D / M / C</th>
                  <th className="num">Entrées</th>
                  <th className="num">Sorties</th>
                  <th className="num">Écart</th>
                </tr>
              </thead>
              <tbody>
                {preview.diff.map((d) => (
                  <tr key={d.group}>
                    <td>{d.group}</td>
                    <td>{d.direction}</td>
                    <td className="num">{d.avant.total}</td>
                    <td className="num">{d.apres.total}</td>
                    <td className="num">
                      {d.apres.d} / {d.apres.m} / {d.apres.c}
                    </td>
                    <td className="num">{d.entrees}</td>
                    <td className="num">{d.sorties}</td>
                    <td className="num">{signed(d.ecart)}</td>
                  </tr>
                ))}
                <tr>
                  <th colSpan={2}>Total</th>
                  <td className="num">{preview.totaux.avant}</td>
                  <td className="num">{preview.totaux.apres}</td>
                  <td />
                  <td className="num">{preview.totaux.entrees}</td>
                  <td className="num">{preview.totaux.sorties}</td>
                  <td className="num">{signed(preview.totaux.apres - preview.totaux.avant)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Paramètres du scénario « {preview.scenarioNom} »</h2>
          <table>
            <thead>
              <tr>
                <th>Direction</th>
                <th className="num">CDI actuel</th>
                <th className="num">CDI importé</th>
                <th className="num">Postes fixes actuels</th>
                <th className="num">Postes fixes importés</th>
              </tr>
            </thead>
            <tbody>
              {preview.parametres.map((p) => (
                <tr key={p.direction}>
                  <td>{p.direction}</td>
                  <td className="num">{p.cdiAvant ?? "–"}</td>
                  <td className="num">{p.cdiApres}</td>
                  <td className="num">{p.fixesAvant ?? "–"}</td>
                  <td className="num">{p.fixesApres}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub" style={{ marginTop: 12 }}>
            {preview.stockagePersonnes
              ? "Les matricules seront conservés sous forme hachée (STORE_PERSONS=true)."
              : "Aucune donnée nominative ne sera conservée : seuls les effectifs agrégés sont enregistrés."}
          </p>
          <button type="button" disabled={pending} onClick={() => run("confirm")}>
            {pending ? "Enregistrement…" : "Confirmer l'import et mettre à jour le scénario"}
          </button>
        </section>
      )}
    </>
  );
}
