export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p className="soon">À venir.</p>
    </section>
  );
}
