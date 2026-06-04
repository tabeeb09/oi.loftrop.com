'use client';
import { Metadata } from 'next';
import { signIn } from 'next-auth/react';

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInButton() {
  return (
   <div className="flex items-center justify-center h-screen">
    <span> Sign in to access this content</span>
    <button onClick={() => signIn('keycloak', { callbackUrl: '/' })}>
      Sign in with Keycloak
    </button>
    <button onClick={() => signIn('google', { callbackUrl: '/' })}>
      Sign in with Google
    </button>
    </div>
  );
}
