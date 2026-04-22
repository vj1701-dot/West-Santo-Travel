import { prisma } from "@west-santo/data";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";
const trustedOrigins = Array.from(
  new Set([baseURL, process.env.APP_BASE_URL].filter((origin): origin is string => Boolean(origin))),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    process.env.SESSION_SECRET ??
    "development-better-auth-secret-change-me-32chars-minimum",
  trustedOrigins,
  plugins: [nextCookies()],
  user: {
    modelName: "User",
  },
  session: {
    modelName: "Session",
  },
  account: {
    modelName: "Account",
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "credential"],
      allowDifferentEmails: false,
    },
  },
  verification: {
    modelName: "Verification",
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "development-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "development-google-client-secret",
      disableSignUp: true,
    },
  },
});
