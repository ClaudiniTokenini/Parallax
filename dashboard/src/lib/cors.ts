import { NextResponse } from "next/server";

const ALLOWED_HEADERS = "Content-Type, Authorization, X-Parallax-Token, Accept";
const ALLOWED_METHODS = "GET, POST, OPTIONS";

function allowOrigin(origin: string | null): string {
  if (origin && origin !== "null") return origin;
  return "*";
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
