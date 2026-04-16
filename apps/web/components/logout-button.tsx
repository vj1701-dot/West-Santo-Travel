"use client";

import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  return (
    <button
      className="pill"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/sign-in";
      }}
      type="button"
    >
      Logout
    </button>
  );
}
