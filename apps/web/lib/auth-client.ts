import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
});

