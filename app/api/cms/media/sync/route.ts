import { NextRequest, NextResponse } from "next/server";

import { forbidden, unauthorized } from "@/src/lib/server/cms-api";
import { AuthError, getWriteRoles, requireRole } from "@/src/lib/server/auth";
import { listMediaObjects } from "@/src/lib/server/s3";

export async function POST(request: NextRequest) {
  try {
    await requireRole(getWriteRoles());
    const body = (await request.json().catch(() => ({}))) as { prefix?: string };
    const listing = await listMediaObjects(body.prefix);

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      ...listing,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
    }

    throw error;
  }
}
