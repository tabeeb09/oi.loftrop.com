"use client";

import { signOut, useSession } from "next-auth/react";

export default function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="app-header">
      <a href="/" className="site-title">
        Tabeeb Rahman
      </a>
      <nav className="header-actions" aria-label="Header links">
        <a href="https://www.linkedin.com/in/tabeeb-rahman-88428722a/">Hire me</a>
        <a href="/docs">Docs</a>
        {status === "loading" ? null : session ? (
          <button type="button" onClick={() => signOut()}>
            Sign out
          </button>
        ) : (
          <a href="/api/auth/signin">Sign in</a>
        )}
      </nav>
    </header>
  );
}
