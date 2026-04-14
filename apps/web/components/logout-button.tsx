"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="pill"
      onClick={() => signOut({ callbackUrl: "/access-denied" })}
      type="button"
    >
      Logout
    </button>
  );
}
