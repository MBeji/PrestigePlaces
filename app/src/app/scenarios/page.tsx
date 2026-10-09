import Link from "next/link";
import { getProposal, listScenarios, ServiceError } from "@/lib/services";
import { currentRights } from "@/components/params/data";
import ScenarioManager, { type ScenarioItem } from "@/components/params/ScenarioManager";
import CompareTable, { type CompareSide } from "@/components/params/CompareTable";
import styles from "@/components/params/params.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scénarios – PrestigePlaces" };

async function sideOf(id: string, name: string): Promise<CompareSide> {
  try {
    const p = await getProposal(id);
    return { name, quota: p.quota, current: p.current };
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) return { name, quota: null, current: null };
    throw e;
  }
}

export default async function Page({ searchParams }: PageProps<"/scenarios">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const all = await listScenarios();
  const rights = await currentRights([]);
  const items: ScenarioItem[] = [];
  // Propositions dérivées regroupées sous leur scénario source.
  for (const s of all.filter((x) => !x.parentId)) {
    items.push({ ...s, createdAt: s.createdAt.toISOString() });
    for (const d of all.filter((x) => x.parentId === s.id)) items.push({ ...d, createdAt: d.createdAt.toISOString() });
  }
  const roots = all.filter((s) => !s.parentId);
  const a = roots.find((s) => s.id === one("a"));
  const b = roots.find((s) => s.id === one("b"));
  const compare = a && b ? [await sideOf(a.id, a.name), await sideOf(b.id, b.name)] : null;

  return (
    <>
      <h1>Scénarios</h1>
      <p className="sub">Créez, dupliquez et faites avancer les scénarios. Une proposition calculée apparaît sous son scénario source.</p>
      <ScenarioManager scenarios={items} can={{ gerer: rights.gerer, valider: rights.valider, publier: rights.publier }} />
      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Comparer deux scénarios</h2>
        <form method="get" className={styles.addrow} style={{ marginBottom: 12 }}>
          <label htmlFor="cmp-a">Scénario A</label>
          <select id="cmp-a" name="a" defaultValue={a?.id ?? roots[0]?.id}>
            {roots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label htmlFor="cmp-b">Scénario B</label>
          <select id="cmp-b" name="b" defaultValue={b?.id ?? roots[1]?.id ?? roots[0]?.id}>
            {roots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" className={styles.btn}>Comparer</button>
        </form>
        {compare ? (
          <>
            <CompareTable a={compare[0]} b={compare[1]} />
            {(!compare[0].quota || !compare[1].quota) && (
              <p className="sub" style={{ marginBottom: 0 }}>
                Un scénario sans proposition calculée n&apos;a pas de quotas : calculez-la depuis <Link href="/proposition">Proposition</Link>.
              </p>
            )}
          </>
        ) : (
          <p className="soon" style={{ margin: 0 }}>Choisissez deux scénarios.</p>
        )}
      </section>
    </>
  );
}
