import { getDb, getMeta } from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function GET(request: Request) {
  getDb();
  return withCors(request, {
    ok: true,
    service: "parallax-dashboard",
    lastExtensionEvent: getMeta("last_extension_event"),
    dataSource: getMeta("data_source")
  });
}
