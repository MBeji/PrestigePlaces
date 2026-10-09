import { DIRECTIONS } from "@/lib/directions";
import { deltaOf, deltaTone, floorsChange, flexHeadcount, formatPercent, maxPresenceRate, sharedSeats, signed } from "./format";
import styles from "./params.module.css";

export interface ProposalTableData {
  quota: Record<string, number>;
  current: Record<string, number>;
  targetHeadcount: Record<string, number>;
  floorsBefore: Record<string, string[]>;
  floorsAfter: Record<string, string[]>;
  fixedSeats: Record<string, number>;
}

const EQUATION = DIRECTIONS.filter((d) => d.inEquation);

/** Tableau par direction : positions actuelles, quota, écart, niveaux avant -> après, postes fixes et partagés, taux de présence maximal. */
export default function ProposalTable({ data }: { data: ProposalTableData }) {
  const totals = EQUATION.reduce((t, d) => ({ current: t.current + (data.current[d.code] ?? 0), quota: t.quota + (data.quota[d.code] ?? 0) }), { current: 0, quota: 0 });
  return (
    <div className={styles.tablewrap}>
      <table>
        <thead>
          <tr>
            <th>Direction</th>
            <th className="num">Actuel</th>
            <th className="num">Quota</th>
            <th className="num">Écart</th>
            <th>Niveaux (avant → après)</th>
            <th className="num">Postes fixes</th>
            <th className="num">Postes partagés</th>
            <th className="num" title="Postes partagés / effectif flexible (effectif cible moins postes fixes)">Présence moyenne max.</th>
          </tr>
        </thead>
        <tbody>
          {EQUATION.map((d) => {
            const quota = data.quota[d.code] ?? 0;
            const current = data.current[d.code] ?? 0;
            const fixed = data.fixedSeats[d.code] ?? 0;
            const target = data.targetHeadcount[d.code] ?? 0;
            const delta = deltaOf(quota, current);
            return (
              <tr key={d.code}>
                <td><span className={styles.dirname}><span className="sw" style={{ background: d.color }} />{d.label}</span></td>
                <td className="num">{current}</td>
                <td className="num">{quota}</td>
                <td className={`num ${styles[deltaTone(delta)]}`}>{signed(delta)}</td>
                <td>{floorsChange(data.floorsBefore[d.code], data.floorsAfter[d.code])}</td>
                <td className="num">{fixed}</td>
                <td className="num">{sharedSeats(quota, fixed)}</td>
                <td className="num" title={`Effectif flexible : ${flexHeadcount(target, fixed)}`}>{formatPercent(maxPresenceRate(quota, fixed, target))}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <th className="num">{totals.current}</th>
            <th className="num">{totals.quota}</th>
            <th className="num">{signed(totals.quota - totals.current)}</th>
            <th colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
