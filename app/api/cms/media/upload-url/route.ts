import { NextResponse } from "next/server";
import { z } from "zod";

import { forbidden, unauthorized } from "@/src/lib/server/cms-api";
import { AuthError, getWriteRoles, requireRole } from "@/src/lib/server/auth";
import { auditLog, sessionActor } from "@/src/lib/server/audit-log";
import { createPresignedUploadUrl, getMediaPublicUrl, getMediaStorageInfo } from "@/src/lib/server/s3";

const requestSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().optional(),
});

export async function POST(request: Request) {
  let keyForAudit: string | null = null;

  try {
    const session = await requireRole(getWriteRoles());

    const body = requestSchema.parse(await request.json());
    keyForAudit = body.key;
    const uploadUrl = await createPresignedUploadUrl(body.key, body.contentType);
    const storage = getMediaStorageInfo();
    auditLog({
      action: "cms.media.presign_upload",
      result: "success",
      ...sessionActor(session),
      resource: storage.bucket,
      target: body.key,
      metadata: { contentType: body.contentType ?? null, project: storage.project, keyPrefix: storage.keyPrefix },
    });

    return NextResponse.json({
      bucket: storage.bucket,
      project: storage.project,
      storagePrefix: storage.keyPrefix,
      key: body.key,
      uploadUrl,
      publicUrl: getMediaPublicUrl(body.key),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      auditLog({
        action: "cms.media.presign_upload",
        result: error.status === 401 ? "failure" : "denied",
        target: keyForAudit,
        message: error.message,
      });
      return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
    }

    throw error;
  }
}
