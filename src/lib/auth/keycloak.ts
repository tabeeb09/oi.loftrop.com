import { getServerSession } from "next-auth";
import { decodeJwt } from "jose";

import { authOptions } from "@/app/auth";
import { env, parseCsv } from "@/src/lib/server/env";

export type AuthenticatedKeycloakUser = {
  email: string | null;
  name: string | null;
  roles: string[];
  sub: string;
  isFileAdmin: boolean;
  uploadLimitBytes: number;
};

function getFileAdminRoles() {
  return parseCsv(process.env.KEYCLOAK_FILE_ADMIN_ROLES).length
    ? parseCsv(process.env.KEYCLOAK_FILE_ADMIN_ROLES)
    : ["owner", "technician", "print_admin", "media_admin"];
}

function getKeycloakSubFromAccessToken(accessToken: string | undefined) {
  if (!accessToken) {
    return null;
  }

  try {
    const decoded = decodeJwt(accessToken);
    return typeof decoded.sub === "string" && decoded.sub ? decoded.sub : null;
  } catch {
    return null;
  }
}

function readNumericClaim(source: Record<string, unknown>, claimPaths: string[]) {
  for (const claimPath of claimPaths) {
    const value = claimPath.split(".").reduce<unknown>((current, segment) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, source);
    const candidate = Array.isArray(value) ? value[0] : value;

    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return Math.trunc(candidate);
    }

    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number.parseInt(candidate.trim(), 10);

      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

export async function requireAuthenticatedKeycloakUser() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return { error: "Authentication required", status: 401 as const };
  }

  const roles = session.user?.roles ?? [];
  const sub =
    session.user?.keycloakSub ??
    session.user?.id ??
    getKeycloakSubFromAccessToken(session.accessToken) ??
    null;
  const decodedAccessToken =
    typeof session.accessToken === "string"
      ? (() => {
          try {
            return decodeJwt(session.accessToken) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : {};
  const uploadLimitBytes =
    readNumericClaim(decodedAccessToken, ["file_upload_limit_bytes", "fileUploadLimitBytes"]) ??
    env.FILE_UPLOAD_MAX_BYTES;

  if (!sub) {
    return {
      error: "Keycloak user identifier is missing from the current session.",
      status: 401 as const,
    };
  }

  return {
    user: {
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
      roles,
      sub,
      isFileAdmin: getFileAdminRoles().some((role) => roles.includes(role)),
      uploadLimitBytes,
    } satisfies AuthenticatedKeycloakUser,
  };
}
