import { NextResponse, type NextRequest } from "next/server";

// Signing out normally goes through the API, which revokes the session and clears
// the cookie. When the API is unreachable the browser would keep a cookie that
// silently signs the user back in later, so this clears it locally. It only ever
// removes the session cookie, and refuses cross-site requests.
const SESSION_COOKIES = [
  { name: "gm_session", secure: false },
  { name: "__Host-gm_session", secure: true },
];

export function POST(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new NextResponse(null, { status: 403 });

  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  for (const { name, secure } of SESSION_COOKIES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure });
  }
  return response;
}
