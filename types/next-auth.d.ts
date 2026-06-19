import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    provider?: string;
    keycloakLogoutUrl?: string;
    error?: "RefreshAccessTokenError";
    user: {
      id?: string | null;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      keycloakSub?: string | null;
      roles: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    idToken?: string;
    email?: string | null;
    keycloakUserId?: string;
    keycloakSub?: string;
    provider?: string;
    roles?: string[];
    roleSyncFailed?: boolean;
    lastRoleSyncAt?: number;
    error?: "RefreshAccessTokenError";
  }
}
