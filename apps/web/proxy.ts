import { NextRequest, NextResponse } from "next/server";

import { findAuthorizedUserByEmail, findAuthorizedUserById } from "@west-santo/data";

import { auth } from "@/auth";

const ACCESS_DENIED_MESSAGE = "Your account is not enabled for this application. Contact an admin.";

const PROXY_ALLOWLIST = ["/api/auth", "/api/bot/link-telegram", "/access-denied", "/sign-in", "/sign-up"];

async function protectedProxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");

  if (PROXY_ALLOWLIST.some((allowedPath) => pathname.startsWith(allowedPath))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  const sessionUser = session?.user;

  if (!sessionUser) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required." } },
        { status: 401 },
      );
    }

    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  const localUser = sessionUser.id
    ? await findAuthorizedUserById(sessionUser.id)
    : sessionUser.email
      ? await findAuthorizedUserByEmail(sessionUser.email)
      : null;
  const role = localUser?.role;
  const isActive = localUser?.isActive === true;

  if (!isActive || !role) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: ACCESS_DENIED_MESSAGE } },
        { status: 403 },
      );
    }

    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
}

export default protectedProxy;

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/itineraries/:path*",
    "/approvals/:path*",
    "/add-flight/:path*",
    "/passengers/:path*",
    "/drivers/:path*",
    "/users/:path*",
    "/submissions/:path*",
    "/reminders/:path*",
    "/api/users/:path*",
    "/api/passengers/:path*",
    "/api/itineraries/:path*",
    "/api/approvals/:path*",
    "/api/drivers/:path*",
    "/api/reminder-rules/:path*",
    "/api/telegram-links/:path*",
    "/api/exports/:path*",
    "/api/mandirs/:path*",
    "/api/dashboard/:path*",
    "/api/airports/:path*",
  ],
};
