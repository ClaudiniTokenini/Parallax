import { NextResponse } from "next/server";

const ALLOWED_HEADERS = "Content-Type, Authorization";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

function allowOrigin(origin: string | null): string {
  if (origin && origin.startsWith("chrome-extension://")) return origin;
  if (origin === "http://127.0.0.1:3000" || origin === "http://localhost:3000") {
    return origin;
  }
  return "http://127.0.0.1:3000";
}

export function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin),
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin"
  };
}

export function withCors(request: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(request.headers.get("origin"))
  });
}

export function preflight(request: Request): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin"))
  });
}
