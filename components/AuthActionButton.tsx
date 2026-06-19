"use client";

import { signIn, signOut, useSession } from "next-auth/react";

type Props = {
  callbackUrl?: string;
  className?: string;
  signInLabel?: string;
  signOutLabel?: string;
};

export default function AuthActionButton({
  callbackUrl = "/",
  className,
  signInLabel = "Sign in",
  signOutLabel = "Sign out",
}: Props) {
  const { data: session } = useSession();

  async function handleSignOut() {
    const logoutUrl = session?.keycloakLogoutUrl;
    const provider = session?.provider;

    if (provider === "keycloak" && logoutUrl) {
      await signOut({ redirect: false, callbackUrl });
      window.location.assign(logoutUrl);
      return;
    }

    await signOut({ callbackUrl });
  }

  if (session) {
    return (
      <button className={className} type="button" onClick={handleSignOut}>
        {signOutLabel}
      </button>
    );
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => signIn("keycloak", { callbackUrl }, { prompt: "login" })}
    >
      {signInLabel}
    </button>
  );
}
