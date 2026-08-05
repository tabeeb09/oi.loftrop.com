import { NextResponse } from "next/server";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { downloadFileContent } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function encodeContentDisposition(filename: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing download token." }, { status: 400 });
  }

  try {
    const { file, data } = await downloadFileContent(auth.user, id, token);

    auditLog({
      action: "files.download",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: id,
      resource: file.objectKey,
      metadata: { ownerSub: file.ownerSub },
    });

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(data.byteLength),
        "Content-Disposition": encodeContentDisposition(file.originalFilename),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    const status =
      message === "File not found."
        ? 404
        : message === "Forbidden"
          ? 403
          : message.includes("token")
            ? 400
            : 500;

    auditLog({
      action: "files.download",
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
