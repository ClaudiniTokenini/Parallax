import { preflight, withCors } from "@/lib/cors";
import { insertPostEvent, parseEventInput } from "@/lib/ingest";
import { userFromDeviceRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(request, { ok: false, error: "Invalid JSON" }, 400);
  }

  const parsed = parseEventInput(body);
  if ("error" in parsed) {
    return withCors(request, { ok: false, error: parsed.error }, 400);
  }

  const auth = userFromDeviceRequest(request, parsed.pairingToken);
  if (auth.invalidToken || !auth.user) {
    return withCors(
      request,
      { ok: false, error: "Unknown pairing code. Copy it from Settings." },
      401
    );
  }

  const result = insertPostEvent(parsed, auth.user.id);
  return withCors(request, { ok: true, ...result });
}
