import { NextResponse } from "next/server";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { uploadFileContent } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing upload token." }, { status: 400 });
  }

  try {
    const buffer = new Uint8Array(await request.arrayBuffer());
    const file = await uploadFileContent(auth.user, id, token, buffer, request.headers.get("content-type"));

    auditLog({
      action: "files.upload",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: id,
      resource: file.objectKey,
      metadata: { ownerSub: file.ownerSub, sizeBytes: file.sizeBytes },
    });

    return NextResponse.json({ file });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status =
      message === "File not found."
        ? 404
        : message === "Forbidden"
          ? 403
          : message.includes("token")
            ? 400
            : 500;

    auditLog({
      action: "files.upload",
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
