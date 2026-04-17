"use client";

import Link from "next/link";

export function LoginButton() {
  return (
    <Link className="pill" href="/sign-in">
      Sign In
    </Link>
  );
}

