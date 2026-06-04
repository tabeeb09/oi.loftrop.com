import { NextResponse } from "next/server";
import { z } from "zod";

import { forbidden, unauthorized } from "@/src/lib/server/cms-api";
import { AuthError, getWriteRoles, requireRole } from "@/src/lib/server/auth";
import { deleteMediaObject } from "@/src/lib/server/s3";

const requestSchema = z.object({
  key: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await requireRole(getWriteRoles());
    const body = requestSchema.parse(await request.json());
    await deleteMediaObject(body.key);

    return NextResponse.json({ ok: true, key: body.key });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
    }

    throw error;
  }
}
