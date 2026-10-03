import { preflight, withCors } from "@/lib/cors";
import { getDb } from "@/lib/db";
import { seedDemoData } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function POST(request: Request) {
  getDb();
  seedDemoData();
  return withCors(request, { ok: true, seeded: true });
}
