"use client";

import { useRouter } from "next/navigation";
import styles from "./params.module.css";

export default function ScenarioSelect({ basePath, scenarios, value }: { basePath: string; scenarios: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <div className={styles.picker}>
      <label htmlFor="scenario-select">Scénario</label>
      <select id="scenario-select" value={value} onChange={(e) => router.push(`${basePath}?scenario=${encodeURIComponent(e.target.value)}`)}>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
