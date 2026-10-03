import crypto from "node:crypto";
import {
  attachSession,
  getSessionId,
  registerWithPassword,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS
} from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
    };
    const user = await registerWithPassword(
      String(body.username || ""),
      String(body.password || ""),
      body.displayName
    );
    const sessionId = (await getSessionId()) || crypto.randomUUID();
    attachSession(sessionId, user.id);
    const response = withCors(request, {
      ok: true,
      displayName: user.displayName,
      username: user.username,
      pairingToken: user.pairingToken
    });
    response.cookies.set(SESSION_COOKIE, sessionId, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
