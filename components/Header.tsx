"use client";

import { useSession } from "next-auth/react";
import AuthActionButton from "./AuthActionButton";

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
          <AuthActionButton callbackUrl="/" />
        ) : (
          <AuthActionButton callbackUrl="/" />
        )}
      </nav>
    </header>
  );
}
