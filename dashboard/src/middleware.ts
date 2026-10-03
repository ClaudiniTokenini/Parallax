import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeaders } from "./lib/cors";

const SESSION_COOKIE = "parallax_sid";

export function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api");

  if (isApi && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("origin"))
    });
  }

  const response = NextResponse.next();

  if (isApi) {
    const headers = corsHeaders(request.headers.get("origin"));
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, String(value));
    }
    return response;
  }

  if (!request.cookies.get(SESSION_COOKIE)) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"]
};
