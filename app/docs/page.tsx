export const metadata = {
  title: "Docs",
};

export default function DocsPage() {
  return (
    <article className="editorial-page paper-article">
      <header className="paper-header">
        <p className="eyebrow">Documentation</p>
        <h1>Project notes</h1>
        <p className="paper-standfirst">
          This section is reserved for longer technical notes and architecture references.
        </p>
      </header>
      <section className="paper-section">
        <h2>Current references</h2>
        <p>
          For source history and implementation details, see the{" "}
          <a href="https://github.com/tabeeb09/oi.loftrop.com">website repository</a>.
        </p>
        <p>
          The live media registry is documented at <a href="/schema/resources">Resource schema</a>.
        </p>
      </section>
    </article>
  );
}
