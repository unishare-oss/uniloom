import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/profile", "/consent"];

/**
 * Sends signed-out visitors on protected pages to login. It only checks that the session
 * cookie exists: the API does the real check.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = getSessionCookie(request, { cookiePrefix: "uniloom" });
  if (
    !signedIn &&
    PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const login = new URL("/login", request.url);
    // Login checks silently first, then comes back here.
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|api/|favicon.ico).*)"] };
