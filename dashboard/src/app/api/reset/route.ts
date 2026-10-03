import { preflight, withCors } from "@/lib/cors";
import { wipeDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function POST(request: Request) {
  try {
    wipeDb();
    return withCors(request, { ok: true, reset: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed";
    return withCors(request, { ok: false, error: message }, 500);
  }
}
