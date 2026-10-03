import { preflight, withCors } from "@/lib/cors";
import { deleteDbFile, getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function POST(request: Request) {
  deleteDbFile();
  getDb();
  return withCors(request, { ok: true, reset: true });
}
