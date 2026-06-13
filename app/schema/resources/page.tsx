import { mediaBaseUrl, mediaBucket, siteResources } from "@/src/lib/resource-schema";

export const metadata = {
  title: "Resource Schema",
};

export default function ResourceSchemaPage() {
  const baseUrl = mediaBaseUrl();
  const bucket = mediaBucket();

  return (
    <article className="schema-page editorial-page">
      <header className="paper-header">
        <p className="eyebrow">Resource schema</p>
        <h1>Media object map</h1>
        <p className="paper-standfirst">
          Source-code resource IDs resolve to object keys under the configured media bucket. To
          migrate from RustFS to AWS S3 or Azure Blob-backed S3 compatibility, update the media base
          URL and bucket rather than editing page-level references.
        </p>
      </header>

      <section className="schema-summary">
        <code>baseUrl = {baseUrl}</code>
        <code>bucket = {bucket}</code>
      </section>

      <div className="schema-table-wrap">
        <table className="schema-table">
          <thead>
            <tr>
              <th>Resource ID</th>
              <th>Kind</th>
              <th>Object key</th>
              <th>Resolved URL</th>
            </tr>
          </thead>
          <tbody>
            {siteResources.map((resource) => {
              const url = `${baseUrl}/${bucket}/${resource.key}`;

              return (
                <tr key={resource.id}>
                  <td>
                    <code>{resource.id}</code>
                  </td>
                  <td>{resource.kind}</td>
                  <td>
                    <code>{resource.key}</code>
                  </td>
                  <td>
                    <a href={url}>{url}</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
