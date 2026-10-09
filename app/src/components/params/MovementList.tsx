import { DIRECTIONS } from "@/lib/directions";
import { groupMovements, type MovementLike } from "./format";
import styles from "./params.module.css";

const LABELS = new Map<string, string>([...DIRECTIONS.map((d) => [d.code, d.label] as [string, string]), ["VIDE", "Libérée (vide)"]]);
const label = (c: string) => LABELS.get(c) ?? c;
const floorTitle = (f: string) => (f === "RDC" ? "Rez-de-chaussée" : `Niveau ${f}`);

/** Mouvements par niveau puis par îlot (numérotation du moteur, propre à la proposition). */
export default function MovementList({ movements }: { movements: readonly MovementLike[] }) {
  if (movements.length === 0) return <p className={styles.muted}>Aucun mouvement : la répartition actuelle respecte déjà les quotas.</p>;
  return (
    <div>
      {groupMovements(movements).map((f) => (
        <div key={f.floor} className={styles.floor}>
          <h3>{floorTitle(f.floor)} <span className={styles.muted}>({f.total} position{f.total > 1 ? "s" : ""})</span></h3>
          {f.islands.map((i) => (
            <div key={String(i.island)} className={styles.island}>
              <strong>{i.island === null ? "Sans îlot" : `Îlot ${i.island}`}</strong>{" "}
              <span className={styles.muted}>{i.flows.map((x) => `${x.count} : ${label(x.from)} → ${label(x.to)}`).join(" · ")}</span>
              <div className={styles.chips}>
                {i.movements.map((m) => (
                  <span key={m.positionId} className={styles.chip} title={`${label(m.from)} → ${label(m.to)}`}>L{m.r} C{m.c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
