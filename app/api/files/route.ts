import { NextResponse } from "next/server";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { listUserFiles } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const ownerSub = url.searchParams.get("ownerSub");
    const result = await listUserFiles(auth.user, { cursor, ownerSub });

    auditLog({
      action: "files.list",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      metadata: { ownerSub: ownerSub || auth.user.sub, cursor },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files.";
    const status = message === "Forbidden" ? 403 : 500;

    auditLog({
      action: "files.list",
      result: status === 403 ? "denied" : "failure",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      message,
      metadata: { ownerSub: auth.user.sub },
    });

    return NextResponse.json({ error: message }, { status });
  }
}
