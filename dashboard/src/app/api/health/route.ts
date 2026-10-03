import { getDb } from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";
import { userFromDeviceRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function GET(request: Request) {
  try {
    getDb();
    const auth = userFromDeviceRequest(request);
    let hasQueryToken = false;
    try {
      hasQueryToken = Boolean(new URL(request.url).searchParams.get("token"));
    } catch {
      hasQueryToken = false;
    }
    const hasToken = Boolean(
      hasQueryToken ||
        request.headers.get("authorization") ||
        request.headers.get("x-parallax-token")
    );

    return withCors(request, {
      ok: true,
      service: "parallax-dashboard",
      paired: hasToken && Boolean(auth.user) && !auth.invalidToken,
      pairingError: auth.invalidToken,
      displayName: auth.user?.displayName ?? null,
      lastExtensionEvent: auth.user?.lastExtensionEvent ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return withCors(request, { ok: false, error: message }, 500);
  }
}
