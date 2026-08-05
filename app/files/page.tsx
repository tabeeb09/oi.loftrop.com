import FileManager from "@/components/FileManager";
import { requireSession } from "@/src/lib/server/auth";
import { env, parseCsv } from "@/src/lib/server/env";
import { getMissingSecrets } from "@/src/lib/server/secret-status";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const missingStorageSecrets = getMissingSecrets("userFilesStorage");

  if (missingStorageSecrets.length) {
    return (
      <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem" }}>
        <h1>User files</h1>
        <p>The file manager cannot start because required runtime secrets are missing.</p>
        <p>Missing keys: {missingStorageSecrets.join(", ")}</p>
        <p>Check <a href="/ops/secrets">/ops/secrets</a> for the full runtime status.</p>
      </div>
    );
  }

  await requireSession();

  return (
    <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>User files</h1>
      <p style={{ maxWidth: "50rem" }}>
        Private uploads stay scoped to the authenticated Keycloak user. Download URLs are short-lived
        and are generated only after server-side authorization.
      </p>
      <p style={{ maxWidth: "50rem", color: "#555" }}>
        Storage provider: <strong>{env.FILE_STORAGE_PROVIDER}</strong>
      </p>
      <FileManager acceptedExtensions={parseCsv(env.FILE_ALLOWED_EXTENSIONS).map((value) =>
        value.startsWith(".") ? value.toLowerCase() : `.${value.toLowerCase()}`
      )} />
    </div>
  );
}
