import { NextResponse } from "next/server";

import { auth } from "@/auth";

const ACCESS_DENIED_MESSAGE = "Your account is not enabled for this application. Contact an admin.";

const protectedProxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");
  const sessionUser = request.auth?.user;

  if (!sessionUser) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required." } },
        { status: 401 },
      );
    }

    const signInUrl = new URL("/api/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (sessionUser.isActive === false || !sessionUser.role) {
    if (isApiRequest) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: ACCESS_DENIED_MESSAGE } },
        { status: 403 },
      );
    }

    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  return NextResponse.next();
});

export default protectedProxy;

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/itineraries/:path*",
    "/transport-tasks/:path*",
    "/approvals/:path*",
    "/add-flight/:path*",
    "/passengers/:path*",
    "/drivers/:path*",
    "/users/:path*",
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
    "/api/transport-tasks/:path*",
    "/api/airports/:path*",
  ],
};
