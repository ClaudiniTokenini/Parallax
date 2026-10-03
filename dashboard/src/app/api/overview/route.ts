import { preflight, withCors } from "@/lib/cors";
import { getOverviewPayload } from "@/lib/insight-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function GET(request: Request) {
  return withCors(request, { ok: true, ...getOverviewPayload() });
}
