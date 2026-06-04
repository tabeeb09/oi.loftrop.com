import { getAllSecretStatuses } from "@/src/lib/server/secret-status";

export const dynamic = "force-dynamic";

export default function SecretStatusPage() {
  const statuses = getAllSecretStatuses();

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Runtime Secret Status</h1>
      <p>This page shows required secret names only. No secret values are exposed.</p>
      <table>
        <thead>
          <tr>
            <th align="left">Group</th>
            <th align="left">Status</th>
            <th align="left">Missing keys</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((status) => (
            <tr key={status.group}>
              <td>{status.group}</td>
              <td>{status.missing.length ? "Missing config" : "Ready"}</td>
              <td>{status.missing.length ? status.missing.join(", ") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
