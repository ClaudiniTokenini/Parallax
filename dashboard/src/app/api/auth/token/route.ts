import { getRequestUser, rotatePairingToken } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser();
    const updated = rotatePairingToken(user.id);
    return withCors(request, { ok: true, pairingToken: updated.pairingToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not rotate pairing code";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
