import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KeycloakProvider from "next-auth/providers/keycloak";
import { decodeJwt } from "jose";

import { env, getAuthSecret } from "@/src/lib/server/env";
import { syncKeycloakUserByEmail } from "@/src/lib/server/keycloak-admin";
import { extractRoles } from "@/src/lib/server/roles";

const providers = [];

if (env.KEYCLOAK_ISSUER && env.KEYCLOAK_CLIENT_ID && env.KEYCLOAK_CLIENT_SECRET) {
  providers.push(
    KeycloakProvider({
      issuer: env.KEYCLOAK_ISSUER,
      clientId: env.KEYCLOAK_CLIENT_ID,
      clientSecret: env.KEYCLOAK_CLIENT_SECRET,
    }),
  );
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      if (account?.provider === "google" && profile && "email_verified" in profile) {
        if (!profile.email_verified) {
          return false;
        }
      }

      try {
        await syncKeycloakUserByEmail({
          email: user.email,
          name: user.name,
          provider: account?.provider,
          emailVerified:
            account?.provider === "google" && profile && "email_verified" in profile
              ? Boolean(profile.email_verified)
              : true,
        });
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      if (account?.provider) {
        token.provider = account.provider;
      }

      let decodedAccessToken: Record<string, unknown> = {};

      if (token.accessToken) {
        try {
          decodedAccessToken = decodeJwt(token.accessToken);
        } catch {
          decodedAccessToken = {};
        }
      }

      const mergedSource = [
        token,
        decodedAccessToken,
        profile && typeof profile === "object" ? profile : {},
      ].reduce<Record<string, unknown>>((accumulator, current) => {
        return { ...accumulator, ...current };
      }, {});
      const email =
        typeof token.email === "string"
          ? token.email
          : typeof mergedSource.email === "string"
            ? mergedSource.email
            : null;

      token.email = email;

      const tokenRoles = Array.from(new Set(extractRoles(mergedSource)));
      const shouldResyncRoles =
        Boolean(email) &&
        (!token.lastRoleSyncAt || Date.now() - token.lastRoleSyncAt > 60_000 || account);

      if (shouldResyncRoles && email) {
        try {
          const synced = await syncKeycloakUserByEmail({
            email,
            name: typeof token.name === "string" ? token.name : null,
            provider: token.provider,
            emailVerified: true,
          });

          token.keycloakUserId = synced.user.id;
          token.roles = Array.from(new Set(synced.roles));
          token.roleSyncFailed = false;
          token.lastRoleSyncAt = Date.now();
        } catch {
          if (account?.provider === "google") {
            token.roleSyncFailed = true;
            token.roles = [];
          } else {
            token.roles = tokenRoles;
          }
        }
      } else if (!token.roles?.length) {
        token.roles = tokenRoles;
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.roles = token.roles ?? [];
      session.error = token.roleSyncFailed ? "RefreshAccessTokenError" : undefined;
      return session;
    },
  },
};
