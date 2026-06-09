import { NextResponse } from "next/server";

import { AuthError, requireRole } from "@/src/lib/server/auth";
import { forbidden, unauthorized } from "@/src/lib/server/cms-api";
import { assignKeycloakClientRoleByEmail } from "@/src/lib/server/keycloak-admin";
import {
  getPrivilegeRequest,
  markPrivilegeRequest,
} from "@/src/lib/server/privilege-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const assignableRoles = new Set(["viewer", "editor", "media_admin", "owner"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireRole(["owner"]);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const current = await getPrivilegeRequest(id);

    if (!current) {
      return NextResponse.json({ error: "Privilege request not found." }, { status: 404 });
    }

    const role =
      typeof body.role === "string" && body.role.trim()
        ? body.role.trim()
        : current.requestedRole;

    if (!assignableRoles.has(role)) {
      return NextResponse.json({ error: "Requested role is not assignable." }, { status: 400 });
    }

    await assignKeycloakClientRoleByEmail(current.email, role);

    const updated = await markPrivilegeRequest(
      id,
      "approved",
      session.user?.email ?? "owner",
      role,
    );

    return NextResponse.json({ request: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? unauthorized() : forbidden();
    }

    throw error;
  }
}
