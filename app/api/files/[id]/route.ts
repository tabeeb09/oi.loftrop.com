import { NextResponse } from "next/server";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { deleteFile } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    const result = await deleteFile(auth.user, id);

    auditLog({
      action: "files.delete",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: id,
      metadata: { ownerSub: auth.user.sub },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete file.";
    const status = message === "File not found." ? 404 : message === "Forbidden" ? 403 : 500;

    auditLog({
      action: "files.delete",
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
