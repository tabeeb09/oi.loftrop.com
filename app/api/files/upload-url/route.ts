import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedKeycloakUser } from "@/src/lib/auth/keycloak";
import { createUploadUrl } from "@/src/lib/files/fileService";
import { auditLog } from "@/src/lib/server/audit-log";

const requestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  visibility: z.enum(["private", "public", "unlisted"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuthenticatedKeycloakUser();

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = requestSchema.parse(await request.json());
    const result = await createUploadUrl(auth.user, body);

    auditLog({
      action: "files.upload_url",
      result: "success",
      actorEmail: auth.user.email,
      actorName: auth.user.name,
      actorRoles: auth.user.roles,
      target: result.file.id,
      resource: result.file.objectKey,
      metadata: { ownerSub: auth.user.sub, filename: result.file.originalFilename },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URL.";
    const status =
      message === "Authentication required"
        ? 401
        : message === "Forbidden"
          ? 403
          : message.includes("not configured")
            ? 500
            : 400;

    auditLog({
      action: "files.upload_url",
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
