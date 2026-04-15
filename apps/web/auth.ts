import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

type AppRole = "ADMIN" | "COORDINATOR" | "PASSENGER";

function getEnv(name: string, fallback: string) {
  return process.env[name] ?? fallback;
}

async function lookupLocalUser(email: string) {
  const { findAuthorizedUserByEmail } = await import("@west-santo/data");
  return findAuthorizedUserByEmail(email);
}

async function syncLoginIdentity(email: string, provider?: string | null, subject?: string | null) {
  const { syncUserIdentityOnLogin } = await import("@west-santo/data");
  return syncUserIdentityOnLogin({ email, provider, subject });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: getEnv("AUTH_SECRET", "development-auth-secret"),
  session: {
    strategy: "jwt",
  },
  pages: {
    error: "/access-denied",
  },
  providers: [
    Keycloak({
      issuer: getEnv("KEYCLOAK_ISSUER", "http://placeholder.invalid/realms/west-santo"),
      clientId: getEnv("KEYCLOAK_CLIENT_ID", "west-santo-web"),
      clientSecret: getEnv("KEYCLOAK_CLIENT_SECRET", "development-keycloak-client-secret"),
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const email = user.email?.toLowerCase();

      if (!email) {
        return "/access-denied";
      }

      const localUser = await lookupLocalUser(email);

      if (!localUser || !localUser.isActive) {
        return "/access-denied";
      }

      await syncLoginIdentity(email, account?.provider ?? "keycloak", account?.providerAccountId ?? null);

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      const email = (user?.email ?? token.email)?.toLowerCase();

      if (email) {
        const localUser = await lookupLocalUser(email);

        if (!localUser || !localUser.isActive) {
          token.userId = undefined;
          token.role = undefined;
          token.isActive = false;
          token.firstName = undefined;
          token.lastName = undefined;
        } else {
          token.email = localUser.email;
          token.userId = localUser.id;
          token.role = localUser.role;
          token.isActive = localUser.isActive;
          token.firstName = localUser.firstName;
          token.lastName = localUser.lastName;
        }
      }

      if (trigger === "update" && session?.user) {
        token.firstName = session.user.firstName;
        token.lastName = session.user.lastName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email ?? null;
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.role = typeof token.role === "string" ? (token.role as AppRole) : undefined;
        session.user.isActive = token.isActive === true;
        session.user.firstName = typeof token.firstName === "string" ? token.firstName : "";
        session.user.lastName = typeof token.lastName === "string" ? token.lastName : "";
      }

      return session;
    },
    authorized({ auth: requestAuth, request }) {
      const { pathname } = request.nextUrl;

      if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/bot/link-telegram") ||
        pathname.startsWith("/access-denied")
      ) {
        return true;
      }

      if (!requestAuth?.user) {
        return false;
      }

      if (requestAuth.user.isActive === false || !requestAuth.user.role) {
        return Response.redirect(new URL("/access-denied", request.url));
      }

      return true;
    },
  },
});
