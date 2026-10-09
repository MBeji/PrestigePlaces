import { redirect } from "next/navigation";
import { can, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ImportForm from "./ImportForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import – PrestigePlaces" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/connexion?callbackUrl=%2Fimport");
  const header = (
    <>
      <h1>Import de l&apos;effectif RH</h1>
      <p className="sub">
        Extraction RH (.xlsx ou .csv) : colonnes Matricule, Nom, Prénom, BU, Grade (D, M, C), Directeur Split, Site. Seul le site de Tunis est retenu. Seuls des
        effectifs agrégés sont conservés.
      </p>
    </>
  );
  if (!can(session, "import")) {
    return (
      <>
        {header}
        <section className="panel" role="alert">
          <p>Vous n&apos;avez pas le droit d&apos;importer l&apos;effectif RH : réservé aux services généraux.</p>
        </section>
      </>
    );
  }
  const scenarios = await prisma.scenario.findMany({
    where: { parentId: null, status: { in: ["DRAFT", "PROPOSED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isActive: true },
  });
  return (
    <>
      {header}
      <ImportForm scenarios={scenarios} />
    </>
  );
}
