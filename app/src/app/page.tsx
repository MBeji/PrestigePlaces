import Link from "next/link";
import { getOverview } from "@/lib/services";
import { formatInt } from "@/lib/overview";
import { chooseScenario } from "@/components/params/data";
import ScenarioSelect from "@/components/params/ScenarioSelect";
import { deltaTone, formatPercent, signed, STATUS_LABELS } from "@/components/params/format";
import styles from "./accueil.module.css";

export const dynamic = "force-dynamic";

/** 0,863 -> « 86,3 » (positions pour 100 personnes). */
const per100 = (rate: number | null) => (rate === null || !Number.isFinite(rate) ? "—" : (rate * 100).toFixed(1).replace(".", ","));

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const requested = typeof sp.scenario === "string" ? sp.scenario : undefined;
  const { scenarios, selected } = await chooseScenario(requested);
  if (!selected) {
    return (
      <section className="panel">
        <h1>Vue d&apos;ensemble</h1>
        <p className="soon">Aucun scénario : initialisez la base avec « npm run db:seed ».</p>
      </section>
    );
  }

  const o = await getOverview(selected.id);
  const maxShare = Math.max(0.0001, ...o.rows.flatMap((r) => [r.headcountShare, r.seatShare]));
  const floored = o.rows.filter((r) => r.floored);

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Vue d&apos;ensemble</h1>
          <p className="sub">
            Répartition des positions de travail du site de Tunis · {o.scenarioName} ({STATUS_LABELS[o.status] ?? o.status})
          </p>
        </div>
        {scenarios.length > 1 && <ScenarioSelect basePath="/" scenarios={scenarios} value={selected.id} />}
      </div>

      <div className={styles.stack}>
        <section className={styles.rule} aria-labelledby="regle">
          <h2 id="regle">Une seule règle, la même pour toutes les directions</h2>
          <p className={styles.claim}>
            Chaque direction reçoit <strong>{per100(o.commonRate)} positions pour 100 personnes</strong> de son effectif cible.
          </p>
          <p className={styles.formula}>
            positions attribuées = {formatInt(o.allocated)} positions à répartir × effectif cible de la direction ÷ {formatInt(o.totals.targetHeadcount)} personnes
          </p>
          <p className={styles.note}>
            Les places suivent uniquement le nombre de personnes : aucune direction n&apos;a de coefficient propre. Les petits écarts
            (au plus {per100(o.maxGap)} position pour 100 personnes) viennent de l&apos;arrondi à l&apos;unité
            {floored.length > 0 ? " et du maintien des postes fixes" : ""}.
          </p>
        </section>

        <section className={`panel ${styles.section}`} aria-labelledby="parametrage">
          <h2 id="parametrage">Les chiffres de paramétrage</h2>
          <p className="sub">Effectif du site de Tunis, positions disponibles et ce qui est mis de côté avant la répartition.</p>
          <div className={styles.eq} aria-label="Effectif cible">
            <Term label="CDI site de Tunis" value={o.totals.cdi} />
            <Op>+</Op>
            <Term label="Consultants externes" value={o.totals.externes} detail="en mission à date" />
            <Op>+</Op>
            <Term
              label="Recrutements retenus"
              value={o.totals.recrutements}
              detail={`${formatInt(o.recruitmentsBySource.SIRH)} SIRH · ${formatInt(o.recruitmentsBySource.MAIL_CLIENT)} mail client`}
            />
            <Op>=</Op>
            <Term label="Effectif cible" value={o.totals.targetHeadcount} result />
          </div>
          <div className={styles.eq} aria-label="Positions à répartir">
            <Term label="Positions du site" value={o.totalPositions} />
            <Op>−</Op>
            <Term label="Fonctions support" value={o.supportPositions} detail="hors équation, ne bougent pas" />
            <Op>−</Op>
            <Term label="Zone à libérer" value={o.zonePositions} detail="salle de formation" />
            <Op>−</Op>
            <Term label="Réserve" value={o.reserve} detail={`${String(o.reservePct).replace(".", ",")} %`} />
            <Op>=</Op>
            <Term label="Positions à répartir" value={o.allocated} result />
          </div>
        </section>

        <section className={`panel ${styles.section}`} aria-labelledby="directions">
          <h2 id="directions">Places attribuées par direction</h2>
          <p className="sub">La part des positions de chaque direction est égale à sa part de l&apos;effectif.</p>
          <div className={styles.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th>Direction</th>
                  <th className="num">CDI</th>
                  <th className="num">Externes</th>
                  <th className="num">Recrutements</th>
                  <th className="num">Effectif cible</th>
                  <th className="num">Part de l&apos;effectif</th>
                  <th className="num">Positions attribuées</th>
                  <th className="num">Part des positions</th>
                  <th className="num">Pour 100 personnes</th>
                  <th className="num">Aujourd&apos;hui</th>
                  <th className="num">Écart</th>
                </tr>
              </thead>
              <tbody>
                {o.rows.map((r) => (
                  <tr key={r.code}>
                    <td><span className={styles.dirname}><span className="sw" style={{ background: r.color }} />{r.label}</span></td>
                    <td className="num">{formatInt(r.cdi)}</td>
                    <td className="num">{formatInt(r.externes)}</td>
                    <td className="num">{formatInt(r.recrutements)}</td>
                    <td className="num">{formatInt(r.targetHeadcount)}</td>
                    <td className="num">{formatPercent(r.headcountShare)}</td>
                    <td className={`num ${styles.emph}`}>{formatInt(r.quota)}</td>
                    <td className="num">{formatPercent(r.seatShare)}</td>
                    <td className="num" title={r.floored ? "Relevé au nombre de postes fixes" : undefined}>{per100(r.seatsPerPerson)}{r.floored ? " *" : ""}</td>
                    <td className="num">{formatInt(r.current)}</td>
                    <td className={`num ${styles[deltaTone(r.delta)]}`}>{signed(r.delta)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th className="num">{formatInt(o.totals.cdi)}</th>
                  <th className="num">{formatInt(o.totals.externes)}</th>
                  <th className="num">{formatInt(o.totals.recrutements)}</th>
                  <th className="num">{formatInt(o.totals.targetHeadcount)}</th>
                  <th className="num">100 %</th>
                  <th className="num">{formatInt(o.totals.quota)}</th>
                  <th className="num">100 %</th>
                  <th className="num">{per100(o.commonRate)}</th>
                  <th className="num">{formatInt(o.totals.current)}</th>
                  <th className="num">{signed(o.totals.quota - o.totals.current)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
          {o.allocated > o.totals.current && (
            <p className="sub" style={{ margin: "8px 0 0" }}>
              Les {formatInt(o.allocated - o.totals.current)} positions vides aujourd&apos;hui sont réparties avec les autres, selon la même règle.
            </p>
          )}
          {floored.length > 0 && <p className="sub" style={{ margin: "8px 0 0" }}>* Quota relevé au nombre de postes fixes (directeur, managers).</p>}
        </section>

        <section className={`panel ${styles.section}`} aria-labelledby="parts">
          <h2 id="parts">Part de l&apos;effectif et part des positions</h2>
          <p className="sub">Pour chaque direction, les deux barres ont la même longueur : les places sont proportionnelles aux personnes.</p>
          <div className={styles.bars}>
            <div className={styles.axis} aria-hidden="true">
              <span />
              <span>Part de l&apos;effectif cible</span>
              <span>Part des positions attribuées</span>
            </div>
            {o.rows.map((r) => (
              <div className={styles.bar} key={r.code}>
                <span className={styles.name}><span className="sw" style={{ background: r.color }} />{r.label}</span>
                <Bar share={r.headcountShare} max={maxShare} color={r.color} label={`${r.label}, part de l'effectif`} prefix="effectif" />
                <Bar share={r.seatShare} max={maxShare} color={r.color} label={`${r.label}, part des positions`} prefix="positions" />
              </div>
            ))}
          </div>
        </section>

        <section className={`panel ${styles.section}`} aria-labelledby="hypotheses">
          <h2 id="hypotheses">Les mêmes hypothèses pour tout le monde</h2>
          <p className="sub">Aucune hypothèse n&apos;est propre à une direction.</p>
          <ul className={styles.same}>
            <Same title="Même taux de présence partout">
              Les tableaux de bord du télétravail suivis depuis un an montrent un taux de présence comparable dans toutes les directions :
              la même hypothèse de télétravail s&apos;applique à toutes les équipes, donc le même nombre de places pour 100 personnes.
            </Same>
            <Same title="Même façon de compter l'effectif">
              CDI du site de Tunis, plus consultants externes en mission, plus recrutements retenus. Stagiaires, nettoyage et sécurité ne sont comptés pour personne.
            </Same>
            <Same title="Même règle pour les recrutements">
              Retenus s&apos;ils sont ouverts dans le SIRH ou annoncés officiellement par le client par mail sur les {o.recruitWindowMonths} prochains mois
              ({formatInt(o.totals.recrutements)} retenus{o.recruitmentsBySource.excluded > 0 ? `, ${formatInt(o.recruitmentsBySource.excluded)} hors fenêtre écartés` : ""}).
            </Same>
            <Same title="Mêmes positions mises de côté">
              Fonctions support ({formatInt(o.supportPositions)} positions) et salle de formation du RDC ({formatInt(o.zonePositions)} positions) sont retirées avant la répartition, pour tout le monde.
            </Same>
            <Same title="Postes fixes conservés">
              Les {formatInt(o.totals.fixedSeats)} postes de directeurs et de managers restent dans leur direction ; aucune direction ne descend sous ses postes fixes.
            </Same>
            <Same title="Même arrondi">
              Arrondi à l&apos;unité au plus fort reste : le total attribué est exactement égal aux positions à répartir.
            </Same>
          </ul>
        </section>

        <section className={`panel ${styles.section}`} aria-labelledby="suite">
          <h2 id="suite">Pour aller plus loin</h2>
          <p className="sub">
            {o.changes !== null
              ? `Dans la proposition calculée, ${formatInt(o.changes)} positions changent de direction ; toutes les autres restent en place.`
              : "Aucune proposition n'est encore calculée pour ce scénario."}
          </p>
          <div className={styles.links}>
            <Link href={`/parametres?scenario=${encodeURIComponent(o.scenarioId)}`}>Modifier les paramètres</Link>
            <Link href={`/proposition?scenario=${encodeURIComponent(o.scenarioId)}`}>Voir la proposition et les mouvements</Link>
            <Link href="/plans">Voir les plans</Link>
          </div>
        </section>
      </div>
    </>
  );
}

function Term({ label, value, detail, result = false }: { label: string; value: number; detail?: string; result?: boolean }) {
  return (
    <div className={`${styles.term} ${result ? styles.result : ""}`}>
      <div className={styles.l}>{label}</div>
      <div className={styles.v}>{formatInt(value)}</div>
      {detail && <div className={styles.d}>{detail}</div>}
    </div>
  );
}

function Op({ children }: { children: string }) {
  return <span className={styles.op} aria-hidden="true">{children}</span>;
}

function Bar({ share, max, color, label, prefix }: { share: number; max: number; color: string; label: string; prefix: string }) {
  return (
    <div className={styles.track} role="img" aria-label={`${label} : ${formatPercent(share)}`}>
      <div className={styles.fill} style={{ width: `${(share / max) * 100}%`, background: color }} />
      <span className={styles.val}>{prefix} {formatPercent(share)}</span>
    </div>
  );
}

function Same({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <span className={styles.check} aria-hidden="true">✓</span>
      <span>
        <b>{title}</b>
        <span className={styles.d}>{children}</span>
      </span>
    </li>
  );
}
