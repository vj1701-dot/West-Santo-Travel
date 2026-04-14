"use client";

import { signIn } from "next-auth/react";

export function LoginButton() {
  return (
    <button
      className="pill"
      onClick={() => signIn("keycloak", { callbackUrl: "/" })}
      type="button"
    >
      Login
    </button>
  );
}
