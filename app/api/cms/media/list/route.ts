import { NextRequest, NextResponse } from "next/server";

import { badRequest, forbidden, unauthorized } from "@/src/lib/server/cms-api";
import { AuthError, getReadRoles, requireRole } from "@/src/lib/server/auth";
import { listMediaObjects } from "@/src/lib/server/s3";

export async function GET(request: NextRequest) {
  try {
    await requireRole(getReadRoles());
    const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
    const payload = await listMediaObjects(prefix);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? unauthorized(error.message) : forbidden(error.message);
    }

    const message = error instanceof Error ? error.message : "Unable to list media";
    return badRequest(message);
  }
}
