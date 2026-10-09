"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculateAction, validateAction } from "@/app/proposition/actions";
import styles from "./params.module.css";

export default function ProposalActions({
  scenarioId, proposalId, status, canCalculate, canValidate, hasProposal,
}: { scenarioId: string; proposalId: string | null; status: string | null; canCalculate: boolean; canValidate: boolean; hasProposal: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const exec = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { kind: "ok", text: r.message ?? "Terminé." } : { kind: "err", text: r.error });
      if (r.ok) router.refresh();
    });

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={pending || !canCalculate} onClick={() => exec(() => calculateAction(scenarioId))}>
          {pending ? "Calcul en cours…" : hasProposal ? "Recalculer la proposition" : "Calculer la proposition"}
        </button>
        {proposalId && (
          <button
            type="button" className={styles.btn} disabled={pending || !canValidate || status !== "PROPOSED"}
            title={status === "VALIDATED" ? "Déjà validée" : undefined}
            onClick={() => window.confirm("Valider cette proposition ? Les paramètres du scénario seront verrouillés.") && exec(() => validateAction(proposalId))}
          >
            {status === "VALIDATED" || status === "PUBLISHED" ? "Proposition validée" : "Valider"}
          </button>
        )}
        {proposalId && <Link href={`/plans?scenario=${proposalId}&vue=changements`}>Voir les changements sur les plans</Link>}
        {!canCalculate && <span className={styles.muted}>Droit « calculer une proposition » requis.</span>}
      </div>
      {msg && <div className={`${styles.msg} ${msg.kind === "err" ? styles.err : styles.ok}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
    </>
  );
}
