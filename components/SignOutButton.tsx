'use client';
import AuthActionButton from "./AuthActionButton";

export default function SignOutButton() {
  return <AuthActionButton callbackUrl="/" signOutLabel="Sign out" />;
}
