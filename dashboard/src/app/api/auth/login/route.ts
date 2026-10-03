import crypto from "node:crypto";
import { attachSession, getSessionId, loginWithPassword, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const user = await loginWithPassword(String(body.username || ""), String(body.password || ""));
    const sessionId = (await getSessionId()) || crypto.randomUUID();
    attachSession(sessionId, user.id);
    const response = withCors(request, {
      ok: true,
      displayName: user.displayName,
      username: user.username
    });
    response.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign in";
    return withCors(request, { ok: false, error: message }, 401);
  }
}
