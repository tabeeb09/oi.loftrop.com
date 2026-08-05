import { NextResponse } from "next/server";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { createDownloadUrl } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    const result = await createDownloadUrl(auth.user, id);

    auditLog({
      action: "files.download_url",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: id,
      resource: result.file.objectKey,
      metadata: { ownerSub: result.file.ownerSub },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create download URL.";
    const status =
      message === "File not found."
        ? 404
        : message === "Forbidden"
          ? 403
          : message.includes("not configured")
            ? 500
            : 400;

    auditLog({
      action: "files.download_url",
      result: status === 403 ? "denied" : "failure",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: id,
      message,
      metadata: { ownerSub: auth.user.sub },
    });

    return NextResponse.json({ error: message }, { status });
  }
}
