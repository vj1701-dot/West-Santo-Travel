import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { findAuthorizedUserByEmail, findAuthorizedUserById, syncUserIdentityOnLogin } from "@west-santo/data";

import { auth } from "@/auth";

const ACCESS_DENIED_MESSAGE = "Your account is not enabled for this application. Contact an admin.";

export type AuthorizedUser = Awaited<ReturnType<typeof findAuthorizedUserById>>;

async function resolveSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email) {
    return { hasSession: false, user: null };
  }

  if (session.user.id) {
    const byId = await findAuthorizedUserById(session.user.id);

    if (byId) {
      if (!byId.identityLinkedAt) {
        const synced = await syncUserIdentityOnLogin({
          email: byId.email,
          provider: "better-auth",
          subject: byId.id,
        });
        return { hasSession: true, user: synced ?? byId };
      }
      return { hasSession: true, user: byId };
    }
  }

  const byEmail = await findAuthorizedUserByEmail(session.user.email);

  if (byEmail && !byEmail.identityLinkedAt) {
    const synced = await syncUserIdentityOnLogin({
      email: byEmail.email,
      provider: "better-auth",
      subject: byEmail.id,
    });
    return { hasSession: true, user: synced ?? byEmail };
  }

  return { hasSession: true, user: byEmail };
}

export async function getOptionalUser() {
  const { user } = await resolveSessionUser();

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/access-denied");
  }

  return user;
}

export async function requireRole(role: "ADMIN" | "COORDINATOR" | "PASSENGER") {
  const user = await requireUser();

  if (user.role !== role) {
    redirect("/access-denied");
  }

  return user;
}

function unauthorizedResponse() {
  return NextResponse.json(
    { error: { code: "UNAUTHENTICATED", message: "Login required." } },
    { status: 401 },
  );
}

function forbiddenResponse(message = ACCESS_DENIED_MESSAGE) {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 },
  );
}

async function getRequestUser() {
  return resolveSessionUser();
}

export async function requireApiUser() {
  const { hasSession, user } = await getRequestUser();

  if (!hasSession) {
    return unauthorizedResponse();
  }

  if (!user || !user.isActive) {
    return forbiddenResponse();
  }

  return user;
}

export async function requireApiRole(role: "ADMIN" | "COORDINATOR" | "PASSENGER") {
  const user = await requireApiUser();

  if (user instanceof Response) {
    return user;
  }

  if (user.role !== role) {
    return forbiddenResponse("You do not have access to this resource.");
  }

  return user;
}

export async function requireApiRoles(roles: Array<"ADMIN" | "COORDINATOR" | "PASSENGER">) {
  const user = await requireApiUser();

  if (user instanceof Response) {
    return user;
  }

  if (!roles.includes(user.role)) {
    return forbiddenResponse("You do not have access to this resource.");
  }

  return user;
}

export { ACCESS_DENIED_MESSAGE };
