import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: a missing session cookie means "certainly signed out",
// so redirect before any protected HTML is sent. A present cookie is NOT trusted;
// the client AuthGuard confirms it with /auth/me and the API authorizes every call.
const SESSION_COOKIES = ["__Host-gm_session", "gm_session"];
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invitation", "/session/end"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API proxy, Next internals and static files.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
