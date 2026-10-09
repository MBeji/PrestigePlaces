import { DIRECTIONS } from "@/lib/directions";
import { deltaOf, deltaTone, signed } from "./format";
import styles from "./params.module.css";

export interface CompareSide {
  name: string;
  /** Null quand aucune proposition n'a été calculée pour ce scénario. */
  quota: Record<string, number> | null;
  current: Record<string, number> | null;
}

const EQUATION = DIRECTIONS.filter((d) => d.inEquation);

/** Quotas et écarts de deux scénarios côte à côte, avec la différence de quota (B − A). */
export default function CompareTable({ a, b }: { a: CompareSide; b: CompareSide }) {
  const cell = (side: CompareSide, code: string) => {
    if (!side.quota || !side.current) return { quota: null, delta: null };
    const quota = side.quota[code] ?? 0;
    return { quota, delta: deltaOf(quota, side.current[code] ?? 0) };
  };
  return (
    <div className={styles.tablewrap}>
      <table>
        <thead>
          <tr>
            <th rowSpan={2}>Direction</th>
            <th colSpan={2} className="num">{a.name}</th>
            <th colSpan={2} className="num">{b.name}</th>
            <th rowSpan={2} className="num">Quota B − A</th>
          </tr>
          <tr><th className="num">Quota</th><th className="num">Écart</th><th className="num">Quota</th><th className="num">Écart</th></tr>
        </thead>
        <tbody>
          {EQUATION.map((d) => {
            const x = cell(a, d.code), y = cell(b, d.code);
            const diff = x.quota !== null && y.quota !== null ? y.quota - x.quota : null;
            return (
              <tr key={d.code}>
                <td><span className={styles.dirname}><span className="sw" style={{ background: d.color }} />{d.label}</span></td>
                <td className="num">{x.quota ?? "—"}</td>
                <td className={`num ${x.delta === null ? "" : styles[deltaTone(x.delta)]}`}>{x.delta === null ? "—" : signed(x.delta)}</td>
                <td className="num">{y.quota ?? "—"}</td>
                <td className={`num ${y.delta === null ? "" : styles[deltaTone(y.delta)]}`}>{y.delta === null ? "—" : signed(y.delta)}</td>
                <td className="num">{diff === null ? "—" : signed(diff)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
